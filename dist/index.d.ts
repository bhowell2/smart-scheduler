export interface TimeoutOptions {
    timeMillis: number;
    recurring?: boolean;
    key?: string;
    bucketKey?: string;
    overwriteKey?: boolean;
    ignorePauseDelay?: boolean;
}
export interface Timeout {
    readonly state: "pending" | "paused" | "complete";
    readonly isComplete: boolean;
    readonly pause: (ignorePauseDelay?: boolean) => void;
    readonly resume: (ignorePauseDelay?: boolean) => void;
    readonly cancel: () => void;
    readonly remainingTime: number;
    readonly options: Readonly<TimeoutOptions>;
}
export declare class Scheduler {
    static DEFAULT_BUCKET_KEY: string;
    private idCounter;
    private readonly interval;
    private expectedSchedulerIntervalExpiration;
    private remainingPauseTime;
    private buckets;
    private shutdown;
    private timeoutId;
    constructor(intervalMillis: number, start?: boolean);
    private started;
    start: () => void;
    stop: () => void;
    private __INTERNAL__runExpiredCallbacks;
    private __INTERNAL__run;
    pause: (ignorePauseDelay?: boolean) => void;
    resume: (ignorePauseDelay?: boolean) => void;
    add: (callback: () => void, options: number | TimeoutOptions) => Timeout;
    pauseTimeout: (timeoutKey: string, bucketKey?: string, ignorePauseDelay?: boolean) => Timeout | undefined;
    pauseTimeoutOnDefaultBucket: (timeoutKey: string, ignorePauseDelay?: boolean) => Timeout | undefined;
    resumeTimeout: (timeoutKey: string, bucketKey?: string, ignorePauseDelay?: boolean) => Timeout | undefined;
    resumeTimeoutOnDefaultBucket: (timeoutKey: string, ignorePauseDelay?: boolean) => Timeout | undefined;
    getTimeoutsForBucket: (bucketKey: string) => Timeout[];
    getDefaultBucketTimeouts: () => Timeout[];
    getTimeoutForKey: (key: string, bucketKey?: string) => Timeout | undefined;
    getTimeoutForDefaultBucket: (key: string) => Timeout | undefined;
}
