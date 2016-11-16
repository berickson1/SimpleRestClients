export declare class ExponentialTime {
    private _initialTime;
    private _maxTime;
    private _growFactor;
    private _jitterFactor;
    private _currentTime;
    private _incrementCount;
    /**
     * @param initialTime  multiplier of exponent
     * @param maxTime      delays won't be greater than this
     * @param growFactor   base of exponent
     * @param jitterFactor
     */
    constructor(_initialTime: number, _maxTime: number, _growFactor?: number, _jitterFactor?: number);
    reset(): void;
    getTime(): number;
    getIncrementCount(): number;
    calculateNext(): number;
    /**
     * @return first call returns initialTime, next calls will return initialTime*growFactor^n + jitter
     */
    getTimeAndCalculateNext(): number;
}
