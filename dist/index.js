"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Scheduler = void 0;
var Scheduler = (function () {
    function Scheduler(intervalMillis, start) {
        var _a;
        var _this = this;
        if (start === void 0) { start = true; }
        this.idCounter = 0;
        this.buckets = (_a = {},
            _a[Scheduler.DEFAULT_BUCKET_KEY] = {},
            _a);
        this.shutdown = false;
        this.started = false;
        this.start = function () {
            if (!_this.started) {
                _this.shutdown = false;
                _this.started = true;
                _this.__INTERNAL__run(_this.interval);
            }
        };
        this.stop = function () {
            if (!_this.shutdown) {
                _this.shutdown = true;
                _this.started = false;
                clearTimeout(_this.timeoutId);
                _this.buckets = {};
            }
        };
        this.__INTERNAL__runExpiredCallbacks = function () {
            for (var bucketsKey in _this.buckets) {
                var bucket = _this.buckets[bucketsKey];
                for (var bucketKey in bucket) {
                    var timeout = bucket[bucketKey];
                    if (timeout.state === "pending" && timeout.remainingTime <= 0) {
                        timeout.callback();
                        if (timeout.options.recurring) {
                            timeout.expiration = Date.now() + timeout.options.timeMillis;
                        }
                        else {
                            timeout.state = "complete";
                            timeout.cancel();
                        }
                    }
                }
            }
            _this.__INTERNAL__run(_this.interval);
        };
        this.__INTERNAL__run = function (timeout) {
            if (!_this.shutdown) {
                _this.expectedSchedulerIntervalExpiration = Date.now() + timeout;
                _this.timeoutId = setTimeout(_this.__INTERNAL__runExpiredCallbacks, timeout);
            }
        };
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
        this.resume = function (ignorePauseDelay) {
            if (_this.remainingPauseTime !== undefined) {
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
            var schedulerBuckets = _this.buckets;
            var timeout = {
                options: options,
                expiration: expiration,
                state: "pending",
                get isComplete() {
                    return this.state === "complete";
                },
                cancel: function () {
                    if (schedulerBuckets[this.options.bucketKey]) {
                        delete schedulerBuckets[this.options.bucketKey][this.options.key];
                    }
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
                return existingTimeoutForKey;
            }
            bucket[options.key] = timeout;
            return timeout;
        };
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
        this.pauseTimeoutOnDefaultBucket = function (timeoutKey, ignorePauseDelay) {
            return _this.pauseTimeout(timeoutKey, Scheduler.DEFAULT_BUCKET_KEY, ignorePauseDelay);
        };
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
        this.resumeTimeoutOnDefaultBucket = function (timeoutKey, ignorePauseDelay) {
            return _this.resumeTimeout(timeoutKey, Scheduler.DEFAULT_BUCKET_KEY, ignorePauseDelay);
        };
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
        this.getDefaultBucketTimeouts = function () {
            return _this.getTimeoutsForBucket(Scheduler.DEFAULT_BUCKET_KEY);
        };
        this.getTimeoutForKey = function (key, bucketKey) {
            if (bucketKey === void 0) { bucketKey = Scheduler.DEFAULT_BUCKET_KEY; }
            var bucket = _this.buckets[bucketKey];
            if (bucket) {
                return bucket[key];
            }
            return;
        };
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
