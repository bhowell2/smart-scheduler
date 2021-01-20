"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Scheduler = void 0;
/**
 * The Scheduler must be provided an interval to check for events. This interval
 * can be as fine as 1 (or even 0...) millisecond. This allows the user to create
 * multiple Schedulers with tighter or looser intervals. By default the Scheduler
 * will be started when it is created, but this can be overridden by providing
 * false as the second constructor argument.
 *
 * This is not exported as a default as it is a bad practice IM(and others)O.
 */
var Scheduler = /** @class */ (function () {
    function Scheduler(intervalMillis, start) {
        var _a;
        var _this = this;
        if (start === void 0) { start = true; }
        this.idCounter = 0;
        /**
         * Used to track the timeouts for each bucket. Timeouts that do not
         * specify a bucket are stored here with DEFAULT_BUCKET_KEY.
         */
        this.buckets = (_a = {},
            _a[Scheduler.DEFAULT_BUCKET_KEY] = {},
            _a);
        this.shutdown = false;
        this.started = false;
        /**
         * Starts the scheduler if it has not already been started. Can
         * be used to start again after it has been stopped.
         */
        this.start = function () {
            if (!_this.started) { // ensures multiple
                _this.shutdown = false;
                _this.started = true;
                _this.__INTERNAL__run(_this.interval);
            }
        };
        /**
         * Stops the scheduler.
         */
        this.stop = function () {
            // need to keep track of this so that
            if (!_this.shutdown) {
                _this.shutdown = true;
                _this.started = false;
                clearTimeout(_this.timeoutId);
                // clear all Timeouts
                _this.buckets = {};
            }
        };
        this.__INTERNAL__runExpiredCallbacks = function () {
            for (var bucketsKey in _this.buckets) {
                var bucket = _this.buckets[bucketsKey];
                for (var bucketKey in bucket) {
                    var timeout = bucket[bucketKey];
                    if (timeout.state === "pending" && timeout.remainingTime <= 0) { // will call
                        // run it and reset the expiration or remove it
                        timeout.callback();
                        if (timeout.options.recurring) {
                            timeout.expiration = Date.now() + timeout.options.timeMillis;
                        }
                        else {
                            timeout.state = "complete";
                            // delete it
                            timeout.cancel();
                        }
                    }
                }
            }
            _this.__INTERNAL__run(_this.interval);
        };
        this.__INTERNAL__run = function (timeout) {
            if (!_this.shutdown) { // need to check if it has been shutdown before rerunning
                _this.expectedSchedulerIntervalExpiration = Date.now() + timeout;
                _this.timeoutId = setTimeout(_this.__INTERNAL__runExpiredCallbacks, timeout);
            }
        };
        /**
         * Pauses all jobs and the scheduler itself.
         *
         * Optionally supply ignorePauseDelay to override each Timeout's
         * ignorePauseDelay setting.
         */
        this.pause = function (ignorePauseDelay) {
            if (_this.remainingPauseTime === undefined) {
                _this.remainingPauseTime = _this.expectedSchedulerIntervalExpiration - Date.now();
                clearTimeout(_this.timeoutId);
                for (var bucketsKey in _this.buckets) {
                    var bucket = _this.buckets[bucketsKey];
                    if (bucket) {
                        for (var key in bucket) {
                            bucket[key].pause(ignorePauseDelay);
                        }
                    }
                }
            }
        };
        /**
         * Resumes the scheduler and all paused timeouts. This does not resume
         * all paused timeouts if the scheduler itself is not paused. If this
         * is desired, use {@link getTimeoutsForBucket} and loop through them.
         *
         * Optionally supply ignorePauseDelay to override each Timeout's
         * ignorePauseDelay setting.
         */
        this.resume = function (ignorePauseDelay) {
            if (_this.remainingPauseTime !== undefined) {
                // need to restart timeout with lower interval
                _this.__INTERNAL__run(_this.remainingPauseTime);
                _this.remainingPauseTime = undefined;
                for (var bucketsKey in _this.buckets) {
                    var bucket = _this.buckets[bucketsKey];
                    if (bucket) {
                        for (var key in bucket) {
                            bucket[key].resume();
                        }
                    }
                }
            }
        };
        /**
         * Adds the callback to be run with the provided options. Defaults will be
         * set if they are not supplied. options must be a number that will correspond
         * to a time (in milliseconds) or options must be an object containing 'timeMillis'.
         * The created Timeout is returned so that it can be controlled as desired.
         */
        this.add = function (callback, options) {
            if (options === undefined || options === null ||
                (typeof options !== "number" && options.timeMillis == undefined)) {
                throw new Error("Cannot add callback without timeout.");
            }
            if (typeof options === "number") {
                options = {
                    timeMillis: options
                };
            }
            options.key = options.key || (_this.idCounter++).toString();
            options.bucketKey = options.bucketKey || Scheduler.DEFAULT_BUCKET_KEY;
            var expiration = options.timeMillis + Date.now();
            /*
            * Capturing the scheduler's buckets so that it can be used in the cancel
            * function. It seems better to capture the bucket rather than the key and
            * bucketKey (and obtain them via options), because the options are more
            * easily accessed by the user and for whatever reason they could change
            * them randomly (unlikely, but who knows..). Anyway, one or the other needs
            * to be captured.
            * */
            var schedulerBuckets = _this.buckets;
            var timeout = {
                options: options,
                expiration: expiration,
                state: "pending",
                get isComplete() {
                    return this.state === "complete";
                },
                cancel: function () {
                    // remove it from bucket's keys
                    if (schedulerBuckets[this.options.bucketKey]) {
                        delete schedulerBuckets[this.options.bucketKey][this.options.key];
                    }
                    // if (this.buckets[bucketKey]) {
                    //   delete this.buckets[bucketKey][key];
                    // }
                },
                pause: function (ignorePauseDelay) {
                    if (this.state === 'pending') {
                        this.state = "paused";
                        if ((ignorePauseDelay !== undefined && !ignorePauseDelay) ||
                            (ignorePauseDelay === undefined && !this.options.ignorePauseDelay)) {
                            this.expiration = this.expiration - Date.now();
                        }
                    }
                },
                resume: function (ignorePauseDelay) {
                    if (this.state === 'paused') {
                        this.state = 'pending';
                        if ((ignorePauseDelay !== undefined && !ignorePauseDelay) ||
                            (ignorePauseDelay === undefined && !this.options.ignorePauseDelay)) {
                            this.expiration = this.expiration + Date.now();
                        }
                    }
                },
                get remainingTime() {
                    return this.expiration - Date.now();
                },
                callback: callback
            };
            var bucket = schedulerBuckets[options.bucketKey];
            if (!bucket) {
                bucket = {};
                schedulerBuckets[options.bucketKey] = bucket;
            }
            var existingTimeoutForKey = bucket[options.key];
            if (existingTimeoutForKey && !options.overwriteKey) {
                // do not overwrite the existing timeout, return it instead.
                return existingTimeoutForKey;
            }
            // does not already exists or should overwrite
            bucket[options.key] = timeout;
            return timeout;
        };
        /**
         * Pauses the Timeout if it exists. Returns the Timeout that was paused or
         * undefined if the Timeout did not exist.
         */
        this.pauseTimeout = function (timeoutKey, bucketKey, ignorePauseDelay) {
            if (bucketKey === void 0) { bucketKey = Scheduler.DEFAULT_BUCKET_KEY; }
            var bucket = _this.buckets[bucketKey];
            if (bucket) {
                var timeout = bucket[timeoutKey];
                if (timeout) {
                    timeout.pause(ignorePauseDelay);
                }
                return timeout;
            }
            return;
        };
        /**
         * Pauses the Timeout if it exists. Returns the Timeout that was paused or
         * undefined if the Timeout did not exist.
         */
        this.pauseTimeoutOnDefaultBucket = function (timeoutKey, ignorePauseDelay) {
            return _this.pauseTimeout(timeoutKey, Scheduler.DEFAULT_BUCKET_KEY, ignorePauseDelay);
        };
        /**
         * Resumes the Timeout if it exists. Returns the Timeout that was resumed or
         * undefined if the Timeout did not exist.
         */
        this.resumeTimeout = function (timeoutKey, bucketKey, ignorePauseDelay) {
            if (bucketKey === void 0) { bucketKey = Scheduler.DEFAULT_BUCKET_KEY; }
            var bucket = _this.buckets[bucketKey];
            if (bucket) {
                var timeout = bucket[timeoutKey];
                if (timeout) {
                    timeout.resume(ignorePauseDelay);
                }
                return timeout;
            }
            return;
        };
        /**
         * Resumes the Timeout if it exists. Returns the Timeout that was resumed or
         * undefined if the Timeout did not exist.
         */
        this.resumeTimeoutOnDefaultBucket = function (timeoutKey, ignorePauseDelay) {
            return _this.resumeTimeout(timeoutKey, Scheduler.DEFAULT_BUCKET_KEY, ignorePauseDelay);
        };
        /**
         * Returns all timeouts that have not expired on the given bucket.
         */
        this.getTimeoutsForBucket = function (bucketKey) {
            var bucket = _this.buckets[bucketKey];
            var timeouts = [];
            if (bucket) {
                for (var key in bucket) {
                    timeouts.push(bucket[key]);
                }
                return timeouts;
            }
            return [];
        };
        /**
         * Returns all timeouts that have not expired on the default bucket.
         */
        this.getDefaultBucketTimeouts = function () {
            return _this.getTimeoutsForBucket(Scheduler.DEFAULT_BUCKET_KEY);
        };
        /**
         * Returns the timeout of the given key on the given bucket if it exists
         * or undefined if it does not exist.
         */
        this.getTimeoutForKey = function (key, bucketKey) {
            if (bucketKey === void 0) { bucketKey = Scheduler.DEFAULT_BUCKET_KEY; }
            var bucket = _this.buckets[bucketKey];
            if (bucket) {
                return bucket[key];
            }
            return;
        };
        /**
         * Returns the timeout of the given key on the default bucket if it exists
         * or undefined if it does not exist.
         */
        this.getTimeoutForDefaultBucket = function (key) {
            return _this.getTimeoutForKey(key);
        };
        if (typeof intervalMillis !== "number") {
            throw new Error("Interval must be a number.");
        }
        this.interval = intervalMillis;
        if (start) {
            this.start();
        }
    }
    Scheduler.DEFAULT_BUCKET_KEY = "__DEFAULT__BUCKET__KEY__";
    return Scheduler;
}());
exports.Scheduler = Scheduler;
