/*global define*/
define([
        '../Core/JulianDate',
        '../Core/TimeInterval',
        '../Core/TimeIntervalCollection',
        '../Core/Iso8601',
        './CzmlCartesian3',
        './CzmlCartographic3',
        './DynamicProperty'
    ], function(
        JulianDate,
        TimeInterval,
        TimeIntervalCollection,
        Iso8601,
        CzmlCartesian3,
        CzmlCartographic3,
        DynamicProperty) {
    "use strict";

    function DynamicPositionProperty() {
        this._dynamicProperties = [];
        this._propertyIntervals = new TimeIntervalCollection();
        this._potentialTypes = [CzmlCartesian3, CzmlCartographic3];
        this._cachedTime = undefined;
        this._cachedInterval = undefined;
        this._cachedCartesianValue = undefined;
        this._cachedCartographicValue = undefined;
    }

    DynamicPositionProperty.processCzmlPacket = function(czmlIntervals, buffer, sourceUri, existingProperty) {
        if (typeof czmlIntervals === 'undefined') {
            return existingProperty;
        }

        //At this point we will definitely have a value, so if one doesn't exist, create it.
        if (typeof existingProperty === 'undefined') {
            existingProperty = new DynamicPositionProperty();
        }

        existingProperty.addIntervals(czmlIntervals, buffer, sourceUri);

        return existingProperty;
    };

    DynamicPositionProperty.prototype.addIntervals = function(czmlIntervals, buffer, sourceUri) {
        if (Array.isArray(czmlIntervals)) {
            for ( var i = 0, len = czmlIntervals.length; i < len; i++) {
                this.addInterval(czmlIntervals[i], buffer, sourceUri);
            }
        } else {
            this.addInterval(czmlIntervals, buffer, sourceUri);
        }
    };

    DynamicPositionProperty.prototype.addInterval = function(czmlInterval, buffer, sourceUri) {
        this._cachedTime = undefined;
        this._cachedInterval = undefined;
        this._cachedCartesianValue = undefined;
        this._cachedCartographicValue = undefined;

        var iso8601Interval = czmlInterval.interval, property, valueType, unwrappedInterval;
        if (typeof iso8601Interval === 'undefined') {
            iso8601Interval = Iso8601.MAXIMUM_INTERVAL.clone();
        } else {
            iso8601Interval = TimeInterval.fromIso8601(iso8601Interval);
        }

        //See if we already have data at that interval.
        var thisIntervals = this._propertyIntervals;
        var existingInterval = thisIntervals.findInterval(iso8601Interval.start, iso8601Interval.stop);

        if (typeof existingInterval !== 'undefined') {
            //If so, see if the new data is the same type.
            property = existingInterval.data;
            if (typeof property !== 'undefined') {
                valueType = property.valueType;
                unwrappedInterval = valueType.unwrapInterval(czmlInterval);
            }
        } else {
            //If not, create it.
            existingInterval = iso8601Interval;
            thisIntervals.addInterval(existingInterval);
        }

        //If the new data was a different type, unwrapping fails, look for a valueType for this type.
        if (typeof unwrappedInterval === 'undefined') {
            for ( var i = 0, len = this._potentialTypes.length; i < len; i++) {
                valueType = this._potentialTypes[i];
                unwrappedInterval = valueType.unwrapInterval(czmlInterval);
                if (typeof unwrappedInterval !== 'undefined') {
                    //Found a valid valueType, but lets check to see if we already have a property with that valueType
                    for ( var q = 0, lenQ = this._dynamicProperties.length; q < lenQ; q++) {
                        if (this._dynamicProperties[q].valueType === valueType) {
                            property = this._dynamicProperties[q];
                            break;
                        }
                    }
                    //If we don't have the property, create it.
                    if (typeof property === 'undefined') {
                        property = new DynamicProperty(valueType);
                        this._dynamicProperties.push(property);
                    }
                    //Save the property in our interval.
                    existingInterval.data = property;
                    break;
                }
            }
        }

        //We could handle the data, add it to the propery.
        if (typeof unwrappedInterval !== 'undefined') {
            property.addIntervalUnwrapped(iso8601Interval.start, iso8601Interval.stop, czmlInterval, unwrappedInterval, buffer, sourceUri);
        }
    };

    DynamicPositionProperty.prototype.getValueCartographic = function(time) {
        //CZML_TODO caching the last used interval here
        //gives an obvious performance boost, but we need
        //to further explore performance all around.
        if (this._cachedTime === time) {
            return this._cachedCartographicValue;
        }
        this._cachedTime = time;
        var interval = this._cachedInterval;
        if (typeof interval === 'undefined' || !interval.contains(time)) {
            interval = this._propertyIntervals.findIntervalContainingDate(time);
            this._cachedInterval = interval;
        }

        if (typeof interval === 'undefined') {
            return undefined;
        }
        var property = interval.data;
        var result = property.getValue(time);
        if (typeof result !== undefined) {
            result = property.valueType.convertToCartographic3(result);
        }
        return this._cachedCartographicValue = result;
    };

    DynamicPositionProperty.prototype.getValueCartesian = function(time) {
        //CZML_TODO Same as getValueCartographic comment on caching.
        if (this._cachedTime === time) {
            return this._cachedCartesianValue;
        }
        this._cachedTime = time;
        var interval = this._cachedInterval;
        if (typeof interval === 'undefined' || !interval.contains(time)) {
            interval = this._propertyIntervals.findIntervalContainingDate(time);
            this._cachedInterval = interval;
        }

        if (typeof interval === 'undefined') {
            return undefined;
        }
        var property = interval.data;
        var result = property.getValue(time);
        if (typeof result !== undefined) {
            result = property.valueType.convertToCartesian3(result);
        }
        return this._cachedCartesianValue = result;
    };

    return DynamicPositionProperty;
});