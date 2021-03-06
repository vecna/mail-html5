define(function() {
    'use strict';

    var er = {};

    er.attachHandler = function(scope) {
        scope.$root.onError = function(options) {
            if (!options) {
                return;
            }

            console.error(options);

            scope.state.dialog = {
                open: true,
                title: options.title || 'Error',
                message: options.errMsg || options.message
            };
            // don't call apply for synchronous calls
            if (!options.sync) {
                scope.$apply();
            }
        };
    };

    return er;
});