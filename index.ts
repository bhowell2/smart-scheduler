export interface TimeoutOptions {
  /**
   * Number of milliseconds from creation time to run the Timeout.
   */
  timeMillis: number

  /**
   * Whether to indefinitely reschedule on the same interval once
   * the Timeout expires. This can be cancelled with {@link Timeout#cancel}
   * or overridden with adding another Timeout of the same key (and
   * bucket, of course) and setting {@link overwriteKey} to true.
   */
  recurring?: boolean

  /**
   * Unique, identifying, key for the Timeout. Used to avoid creating
   * multiple timers of the same key and also provides debounce type
   * functionality.
   *
   * No key means that the callback is treated independently, even if
   * it has strict equality with another another callback that has already
   * been scheduled.
   */
  key?: string

  /**
   * Adds the key to a bucket so that all keys in the bucket can be
   * treated together.
   *
   * Defaults to {@link Scheduler#DEFAULT_BUCKET_KEY}.
   */
  bucketKey?: string

  /**
   * Whether or not to overwrite the Timeout if the key already exists.
   *
   * This also acts as a debouncer. If overwriteKey = true this will
   * cause the timeout to debounce until no other calls have been made
   * to add a Timeout with the same key before it has been called. If
   * overwriteKey = false then only the first callback for the key will
   * be called within the interval.
   *
   * Defaults to false.
   */
  overwriteKey?: boolean

  /**
   * When paused, the time remaining can either be saved and started back
   * when the Timeout is resumed or it can use the Timeout's original expiration.
   * When this is true, the original expiration will be used; when this is false
   * the expiration will be adjusted by the pause time.
   *
   * E.g., Timeout has 250ms before expiration and is paused; resume is called
   * after 500ms; if ignorePauseDelay = true then the Timeout's callback would
   * be run immediately, however if ignorePauseDelay = false then the Timeout
   * will run 250ms after resume is called.
   *
   * Note this can be overridden by passing in ignorePauseDelay in the pause or
   * resume of the Timeout or Scheduler.
   *
   * Defaults to false (i.e., adjust expiration by pause delay).
   */
  ignorePauseDelay?: boolean
}

/**
 * Return value from creating a Timeout. Allows for checking the state
 * of the Timeout and pausing, resuming, or canceling the Timeout. The
 * options used to create the Timeout are also provided here along with
 * any defaults that were set for them.
 */
export interface Timeout {

  /**
   * Pretty self-explanatory. Note that the state will never be 'complete'
   * if the Timeout is recurring.
   */
  readonly state: "pending" | "paused" | "complete"

  /**
   * Whether or not the Timeout has completed running. This will always be
   * false for recurring Timeouts. (This is just state === "complete".)
   */
  readonly isComplete: boolean

  /**
   * Allows for pausing the Timeout for any amount of time. When resumed
   * one of two things will happen:
   * 1. TimeoutOptions.ignorePauseDelay = false: the time remaining on the
   *    callback will be used to generate the new expiration time from
   *    that moment forward.
   * 2. TimeoutOptions.ignorePauseDelay = true: the expiration time will not
   *    change when resumed and will expire (callback called) whenever it
   *    originally would have expired.
   *
   * This allows for providing ignorePauseDelay on a per-call basis, which will
   * override the existing TimeoutOptions.ignorePauseDelay if provided. Leave
   * this as undefined if it is not desired to override TimeoutOptions.ignorePauseDelay.
   */
  readonly pause: (ignorePauseDelay?: boolean) => void

  /**
   * Starts the Timeout back if it was paused, otherwise does nothing.
   * See {@link pause} for more information.
   *
   * This allows for providing ignorePauseDelay on a per-call basis, which will
   * override the existing TimeoutOptions.ignorePauseDelay if provided. Leave
   * this as undefined if it is not desired to override TimeoutOptions.ignorePauseDelay.
   */
  readonly resume: (ignorePauseDelay?: boolean) => void

  /**
   * Cancels the Timeout from running if it has not already run or is recurring.
   */
  readonly cancel: () => void

  /**
   * How long until the Timeout is called.
   */
  readonly remainingTime: number

  /**
   * The bucketKey and key will have been set to defaults on this if they were
   * not originally provided.
   */
  readonly options: Readonly<TimeoutOptions>
}

/**
 * Used internally (Scheduler) for tracking.
 */
interface TimeoutInternal extends Timeout {

  /**
   * Internally is not read only.
   */
  state: "pending" | "paused" | "complete"

  /**
   * Date.now() + timeMillis. If the Timeout is paused, this will be set
   * to the remaining time (expiration - Date.now()) while it is paused.
   * Once the timeout is resumed this value will be used to reset the
   * expiration time (expiration + Date.now()).
   */
  expiration: number

  /**
   * The callback to be made when the Timeout expires.
   */
  callback: () => void
}

/**
 * The Scheduler must be provided an interval to check for events. This interval
 * can be as fine as 1 (or even 0...) millisecond. This allows the user to create
 * multiple Schedulers with tighter or looser intervals. By default the Scheduler
 * will be started when it is created, but this can be overridden by providing
 * false as the second constructor argument.
 *
 * This is not exported as a default as it is a bad practice IM(and others)O.
 */
export class Scheduler {

  static DEFAULT_BUCKET_KEY = "__DEFAULT__BUCKET__KEY__";

  private idCounter: number = 0

  // the interval on which the scheduler checks for expired tasks
  private readonly interval: number

  private expectedSchedulerIntervalExpiration: number // Date.now() + interval;
  private remainingPauseTime: number | undefined  // expectedExpiration - Date.now() (date.now of pause time)

  /**
   * Used to track the timeouts for each bucket. Timeouts that do not
   * specify a bucket are stored here with DEFAULT_BUCKET_KEY.
   */
  private buckets: {[bucketKey: string]: {[timeoutKey: string]: TimeoutInternal}} = {
    [Scheduler.DEFAULT_BUCKET_KEY]: {}
  };

  private shutdown = false;

  private timeoutId: number | NodeJS.Timeout

  constructor(intervalMillis: number, start = true) {
    if (typeof intervalMillis !== "number") {
      throw new Error("Interval must be a number.")
    }
    this.interval = intervalMillis;
    if (start) {
      this.start();
    }
  }

  private started = false;

  /**
   * Starts the scheduler if it has not already been started. Can
   * be used to start again after it has been stopped.
   */
  start = () => {
    if (!this.started) {  // ensures multiple
      this.shutdown = false;
      this.started = true;
      this.__INTERNAL__run(this.interval);
    }
  }

  /**
   * Stops the scheduler.
   */
  stop = () => {
    // need to keep track of this so that
    if (!this.shutdown) {
      this.shutdown = true;
      this.started = false;
      clearTimeout(this.timeoutId as any);
      // clear all Timeouts
      this.buckets = {};
    }
  };

  private __INTERNAL__runExpiredCallbacks = () => {
    for (const bucketsKey in this.buckets) {
      const bucket = this.buckets[bucketsKey];
      for (const bucketKey in bucket) {
        const timeout = bucket[bucketKey];
        if (timeout.state === "pending" && timeout.remainingTime <= 0) { // will call
          // run it and reset the expiration or remove it
          timeout.callback();
          if (timeout.options.recurring) {
            timeout.expiration = Date.now() + timeout.options.timeMillis;
          } else {
            timeout.state = "complete";
            // delete it
            timeout.cancel();
          }
        }
      }
    }
    this.__INTERNAL__run(this.interval);
  }

  private __INTERNAL__run = (timeout: number) => {
    if (!this.shutdown) { // need to check if it has been shutdown before rerunning
      this.expectedSchedulerIntervalExpiration = Date.now() + timeout;
      this.timeoutId = setTimeout(this.__INTERNAL__runExpiredCallbacks, timeout);
    }
  }

  /**
   * Pauses all jobs and the scheduler itself.
   *
   * Optionally supply ignorePauseDelay to override each Timeout's
   * ignorePauseDelay setting.
   */
  pause = (ignorePauseDelay?: boolean) => {
    if (this.remainingPauseTime === undefined) {
      this.remainingPauseTime = this.expectedSchedulerIntervalExpiration - Date.now();
      clearTimeout(this.timeoutId as any);
      for (const bucketsKey in this.buckets) {
        const bucket = this.buckets[bucketsKey];
        if (bucket) {
          for (const key in bucket) {
            bucket[key].pause(ignorePauseDelay);
          }
        }
      }
    }
  }

  /**
   * Resumes the scheduler and all paused timeouts. This does not resume
   * all paused timeouts if the scheduler itself is not paused. If this
   * is desired, use {@link getTimeoutsForBucket} and loop through them.
   *
   * Optionally supply ignorePauseDelay to override each Timeout's
   * ignorePauseDelay setting.
   */
  resume = (ignorePauseDelay?: boolean) => {
    if (this.remainingPauseTime !== undefined) {
      // need to restart timeout with lower interval
      this.__INTERNAL__run(this.remainingPauseTime);
      this.remainingPauseTime = undefined;
      for (const bucketsKey in this.buckets) {
        const bucket = this.buckets[bucketsKey];
        if (bucket) {
          for (const key in bucket) {
            bucket[key].resume();
          }
        }
      }
    }
  }

  /**
   * Adds the callback to be run with the provided options. Defaults will be
   * set if they are not supplied. options must be a number that will correspond
   * to a time (in milliseconds) or options must be an object containing 'timeMillis'.
   * The created Timeout is returned so that it can be controlled as desired.
   */
  add = (callback: () => void, options: number | TimeoutOptions): Timeout => {
    if (
      options === undefined || options === null ||
      (typeof options !== "number" && options.timeMillis == undefined)
    ) {
      throw new Error("Cannot add callback without timeout.");
    }
    if (typeof options === "number") {
      options = {
        timeMillis: options
      }
    }
    options.key = options.key || (this.idCounter++).toString();
    options.bucketKey = options.bucketKey || Scheduler.DEFAULT_BUCKET_KEY;
    const expiration = options.timeMillis + Date.now();

    /*
    * Capturing the scheduler's buckets so that it can be used in the cancel
    * function. It seems better to capture the bucket rather than the key and
    * bucketKey (and obtain them via options), because the options are more
    * easily accessed by the user and for whatever reason they could change
    * them randomly (unlikely, but who knows..). Anyway, one or the other needs
    * to be captured.
    * */
    const schedulerBuckets = this.buckets;
    const timeout: TimeoutInternal = {
      options,
      expiration,
      state: "pending",
      get isComplete() {
        return this.state === "complete"
      },
      cancel() {
        // remove it from bucket's keys
        if (schedulerBuckets[this.options.bucketKey]) {
          delete schedulerBuckets[this.options.bucketKey][this.options.key];
        }
        // if (this.buckets[bucketKey]) {
        //   delete this.buckets[bucketKey][key];
        // }
      },
      pause(ignorePauseDelay?: boolean) {
        if (this.state === 'pending') {
          this.state = "paused"
          if (
            (ignorePauseDelay !== undefined && !ignorePauseDelay) ||
            (ignorePauseDelay === undefined && !this.options.ignorePauseDelay)
          ) {
            this.expiration = this.expiration - Date.now();
          }
        }
      },
      resume(ignorePauseDelay?: boolean) {
        if (this.state === 'paused') {
          this.state = 'pending';
          if (
            (ignorePauseDelay !== undefined && !ignorePauseDelay) ||
            (ignorePauseDelay === undefined && !this.options.ignorePauseDelay)
          ) {
            this.expiration = this.expiration + Date.now();
          }
        }
      },
      get remainingTime() {
        return this.expiration - Date.now();
      },
      callback
    };
    let bucket = schedulerBuckets[options.bucketKey];
    if (!bucket) {
      bucket = {};
      schedulerBuckets[options.bucketKey] = bucket;
    }
    const existingTimeoutForKey = bucket[options.key];
    if (existingTimeoutForKey && !options.overwriteKey) {
      // do not overwrite the existing timeout, return it instead.
      return existingTimeoutForKey;
    }
    // does not already exists or should overwrite
    bucket[options.key] = timeout;
    return timeout;
  }

  /**
   * Pauses the Timeout if it exists. Returns the Timeout that was paused or
   * undefined if the Timeout did not exist.
   */
  pauseTimeout = (timeoutKey: string,
                  bucketKey: string = Scheduler.DEFAULT_BUCKET_KEY,
                  ignorePauseDelay?: boolean): Timeout | undefined => {
    const bucket = this.buckets[bucketKey];
    if (bucket) {
      const timeout = bucket[timeoutKey];
      if (timeout) {
        timeout.pause(ignorePauseDelay);
      }
      return timeout;
    }
    return;
  }

  /**
   * Pauses the Timeout if it exists. Returns the Timeout that was paused or
   * undefined if the Timeout did not exist.
   */
  pauseTimeoutOnDefaultBucket = (timeoutKey: string, ignorePauseDelay?: boolean): Timeout | undefined => {
    return this.pauseTimeout(timeoutKey, Scheduler.DEFAULT_BUCKET_KEY, ignorePauseDelay);
  }

  /**
   * Resumes the Timeout if it exists. Returns the Timeout that was resumed or
   * undefined if the Timeout did not exist.
   */
  resumeTimeout = (timeoutKey: string,
                   bucketKey: string = Scheduler.DEFAULT_BUCKET_KEY,
                   ignorePauseDelay?: boolean): Timeout | undefined => {
    const bucket = this.buckets[bucketKey];
    if (bucket) {
      const timeout = bucket[timeoutKey];
      if (timeout) {
        timeout.resume(ignorePauseDelay);
      }
      return timeout;
    }
    return;
  }

  /**
   * Resumes the Timeout if it exists. Returns the Timeout that was resumed or
   * undefined if the Timeout did not exist.
   */
  resumeTimeoutOnDefaultBucket = (timeoutKey: string, ignorePauseDelay?: boolean): Timeout | undefined => {
    return this.resumeTimeout(timeoutKey, Scheduler.DEFAULT_BUCKET_KEY, ignorePauseDelay);
  }

  /**
   * Returns all timeouts that have not expired on the given bucket.
   */
  getTimeoutsForBucket = (bucketKey: string): Timeout[] => {
    const bucket = this.buckets[bucketKey];
    let timeouts = [];
    if (bucket) {
      for (const key in bucket) {
        timeouts.push(bucket[key]);
      }
      return timeouts;
    }
    return [];
  }

  /**
   * Returns all timeouts that have not expired on the default bucket.
   */
  getDefaultBucketTimeouts = (): Timeout[] => {
    return this.getTimeoutsForBucket(Scheduler.DEFAULT_BUCKET_KEY);
  }

  /**
   * Returns the timeout of the given key on the given bucket if it exists
   * or undefined if it does not exist.
   */
  getTimeoutForKey = (key: string, bucketKey: string = Scheduler.DEFAULT_BUCKET_KEY): Timeout | undefined => {
    const bucket = this.buckets[bucketKey];
    if (bucket) {
      return bucket[key];
    }
    return;
  }

  /**
   * Returns the timeout of the given key on the default bucket if it exists
   * or undefined if it does not exist.
   */
  getTimeoutForDefaultBucket = (key: string): Timeout | undefined => {
    return this.getTimeoutForKey(key);
  }

}
