export interface TimeoutOptions {
    /**
     * Number of milliseconds from creation time to run the Timeout.
     */
    timeMillis: number;
    /**
     * Whether to indefinitely reschedule on the same interval once
     * the Timeout expires. This can be cancelled with {@link Timeout#cancel}
     * or overridden with adding another Timeout of the same key (and
     * bucket, of course) and setting {@link overwriteKey} to true.
     */
    recurring?: boolean;
    /**
     * Unique, identifying, key for the Timeout. Used to avoid creating
     * multiple timers of the same key and also provides debounce type
     * functionality.
     *
     * No key means that the callback is treated independently, even if
     * it has strict equality with another another callback that has already
     * been scheduled.
     */
    key?: string;
    /**
     * Adds the key to a bucket so that all keys in the bucket can be
     * treated together.
     *
     * Defaults to {@link Scheduler#DEFAULT_BUCKET_KEY}.
     */
    bucketKey?: string;
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
    overwriteKey?: boolean;
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
    ignorePauseDelay?: boolean;
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
    readonly state: "pending" | "paused" | "complete";
    /**
     * Whether or not the Timeout has completed running. This will always be
     * false for recurring Timeouts. (This is just state === "complete".)
     */
    readonly isComplete: boolean;
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
    readonly pause: (ignorePauseDelay?: boolean) => void;
    /**
     * Starts the Timeout back if it was paused, otherwise does nothing.
     * See {@link pause} for more information.
     *
     * This allows for providing ignorePauseDelay on a per-call basis, which will
     * override the existing TimeoutOptions.ignorePauseDelay if provided. Leave
     * this as undefined if it is not desired to override TimeoutOptions.ignorePauseDelay.
     */
    readonly resume: (ignorePauseDelay?: boolean) => void;
    /**
     * Cancels the Timeout from running if it has not already run or is recurring.
     */
    readonly cancel: () => void;
    /**
     * How long until the Timeout is called.
     */
    readonly remainingTime: number;
    /**
     * The bucketKey and key will have been set to defaults on this if they were
     * not originally provided.
     */
    readonly options: Readonly<TimeoutOptions>;
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
export declare class Scheduler {
    static DEFAULT_BUCKET_KEY: string;
    private idCounter;
    private readonly interval;
    private expectedSchedulerIntervalExpiration;
    private remainingPauseTime;
    /**
     * Used to track the timeouts for each bucket. Timeouts that do not
     * specify a bucket are stored here with DEFAULT_BUCKET_KEY.
     */
    private buckets;
    private shutdown;
    private timeoutId;
    constructor(intervalMillis: number, start?: boolean);
    private started;
    /**
     * Starts the scheduler if it has not already been started. Can
     * be used to start again after it has been stopped.
     */
    start: () => void;
    /**
     * Stops the scheduler.
     */
    stop: () => void;
    private __INTERNAL__runExpiredCallbacks;
    private __INTERNAL__run;
    /**
     * Pauses all jobs and the scheduler itself.
     *
     * Optionally supply ignorePauseDelay to override each Timeout's
     * ignorePauseDelay setting.
     */
    pause: (ignorePauseDelay?: boolean) => void;
    /**
     * Resumes the scheduler and all paused timeouts. This does not resume
     * all paused timeouts if the scheduler itself is not paused. If this
     * is desired, use {@link getTimeoutsForBucket} and loop through them.
     *
     * Optionally supply ignorePauseDelay to override each Timeout's
     * ignorePauseDelay setting.
     */
    resume: (ignorePauseDelay?: boolean) => void;
    /**
     * Adds the callback to be run with the provided options. Defaults will be
     * set if they are not supplied. options must be a number that will correspond
     * to a time (in milliseconds) or options must be an object containing 'timeMillis'.
     * The created Timeout is returned so that it can be controlled as desired.
     */
    add: (callback: () => void, options: number | TimeoutOptions) => Timeout;
    /**
     * Pauses the Timeout if it exists. Returns the Timeout that was paused or
     * undefined if the Timeout did not exist.
     */
    pauseTimeout: (timeoutKey: string, bucketKey?: string, ignorePauseDelay?: boolean) => Timeout | undefined;
    /**
     * Pauses the Timeout if it exists. Returns the Timeout that was paused or
     * undefined if the Timeout did not exist.
     */
    pauseTimeoutOnDefaultBucket: (timeoutKey: string, ignorePauseDelay?: boolean) => Timeout | undefined;
    /**
     * Resumes the Timeout if it exists. Returns the Timeout that was resumed or
     * undefined if the Timeout did not exist.
     */
    resumeTimeout: (timeoutKey: string, bucketKey?: string, ignorePauseDelay?: boolean) => Timeout | undefined;
    /**
     * Resumes the Timeout if it exists. Returns the Timeout that was resumed or
     * undefined if the Timeout did not exist.
     */
    resumeTimeoutOnDefaultBucket: (timeoutKey: string, ignorePauseDelay?: boolean) => Timeout | undefined;
    /**
     * Returns all timeouts that have not expired on the given bucket.
     */
    getTimeoutsForBucket: (bucketKey: string) => Timeout[];
    /**
     * Returns all timeouts that have not expired on the default bucket.
     */
    getDefaultBucketTimeouts: () => Timeout[];
    /**
     * Returns the timeout of the given key on the given bucket if it exists
     * or undefined if it does not exist.
     */
    getTimeoutForKey: (key: string, bucketKey?: string) => Timeout | undefined;
    /**
     * Returns the timeout of the given key on the default bucket if it exists
     * or undefined if it does not exist.
     */
    getTimeoutForDefaultBucket: (key: string) => Timeout | undefined;
}
