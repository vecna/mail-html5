define(function(require) {
    'use strict';

    var angular = require('angular'),
        str = require('js/app-config').string,
        cfg = require('js/app-config').config,
        appController = require('js/app-controller'),
        errorUtil = require('js/util/error'),
        _ = require('underscore'),
        emailDao, outboxBo;

    //
    // Controller
    //

    var NavigationCtrl = function($scope) {
        // global state... inherited to all child scopes
        $scope.$root.state = {};
        // attach global error handler
        errorUtil.attachHandler($scope);

        emailDao = appController._emailDao;
        outboxBo = appController._outboxBo;

        //
        // scope functions
        //

        $scope.state.nav = {
            open: false,
            toggle: function(to) {
                this.open = to;
            }
        };

        $scope.openFolder = function(folder) {
            $scope.state.nav.currentFolder = folder;
            $scope.state.nav.toggle(false);
        };

        $scope.onOutboxUpdate = function(err, count) {
            var outbox, mail;

            if (err) {
                $scope.onError(err);
                return;
            }

            outbox = _.findWhere($scope.account.folders, {
                type: 'Outbox'
            });
            // update the outbox mail count
            outbox.count = count;

            // if we're NOT viewing the outbox or we're not looking at any mail now, we're done
            if ($scope.state.nav.currentFolder !== outbox || !$scope.state.mailList.selected) {
                $scope.$apply();
                return;
            }

            // so we're currently in the outbox.
            // if the currently selected mail is still among the pending mails, re-select it, since the object has changed.
            // however, if the mail is NOT in the outbox anymore, select another pending mail
            //
            // this is a workaround due to the fact that the outbox loads pending messages from the indexedDB, 
            // where object identity is broken when you read an object twice, which happens upon the next retry
            // to send the pending messages...

            mail = _.findWhere(outbox.messages, {
                id: $scope.state.mailList.selected.id
            });

            if (mail) {
                // select the 'new old' mail
                $scope.state.mailList.selected = mail;
            } else {
                if (outbox.messages.length) {
                    // there are more mails to show, select another one in the list
                    $scope.state.mailList.selected = outbox.messages[0];
                } else {
                    // no mails to show, don't select anything...
                    $scope.state.mailList.selected = undefined;
                }
            }

            $scope.$apply();
        };

        //
        // Start
        //

        // init folders
        initFolders();
        // select inbox as the current folder on init
        $scope.openFolder($scope.account.folders[0]);

        //
        // helper functions
        //

        function initFolders() {
            if (window.chrome && chrome.identity) {
                // get pointer to account/folder/message tree on root scope
                $scope.$root.account = emailDao._account;

                // set notificatio handler for sent messages
                outboxBo.onSent = sentNotification;
                // start checking outbox periodically
                outboxBo.startChecking($scope.onOutboxUpdate);
                // make function available globally for write controller
                $scope.emptyOutbox = outboxBo._processOutbox.bind(outboxBo);
                return;
            }

            // attach dummy folders for development
            $scope.$root.account = {};
            $scope.account.folders = [{
                type: 'Inbox',
                count: 2,
                path: 'INBOX'
            }, {
                type: 'Sent',
                count: 0,
                path: 'SENT'
            }, {
                type: 'Outbox',
                count: 0,
                path: 'OUTBOX'
            }, {
                type: 'Drafts',
                count: 0,
                path: 'DRAFTS'
            }, {
                type: 'Trash',
                count: 0,
                path: 'TRASH'
            }];
        }

        function sentNotification(email) {
            chrome.notifications.create('o' + email.id, {
                type: 'basic',
                title: 'Message sent',
                message: email.subject.replace(str.subjectPrefix, ''),
                iconUrl: chrome.runtime.getURL(cfg.iconPath)
            }, function() {});
        }
    };

    //
    // Directives
    //

    var ngModule = angular.module('navigation', []);
    ngModule.directive('keyShortcuts', function($timeout) {
        return function(scope, elm) {
            elm.bind('keydown', function(e) {
                // global state is not yet set, ignore keybaord shortcuts
                if (!scope.state) {
                    return;
                }

                var modifier = e.ctrlKey || e.metaKey;

                if (modifier && e.keyCode === 78 && scope.state.writer && !scope.state.writer.open) {
                    // n -> new mail
                    e.preventDefault();
                    scope.state.writer.write();

                } else if (modifier && e.keyCode === 70 && !scope.state.writer.open) {
                    // f -> find
                    e.preventDefault();
                    scope.state.mailList.searching = true;
                    $timeout(function() {
                        scope.state.mailList.searching = false;
                    }, 200);

                } else if (modifier && e.keyCode === 82 && scope.state.writer && !scope.state.writer.open && scope.state.mailList.selected) {
                    // r -> reply
                    e.preventDefault();
                    scope.state.writer.write(scope.state.mailList.selected);

                } else if (modifier && e.keyCode === 83 && scope.state.writer && !scope.state.writer.open && scope.state.mailList.synchronize) {
                    // s -> sync folder
                    e.preventDefault();
                    scope.state.mailList.synchronize();

                } else if (e.keyCode === 27 && scope.state.writer.open) {
                    // escape -> close writer
                    e.preventDefault();
                    scope.state.writer.close();

                } else if (e.keyCode === 27 && scope.state.account.open) {
                    // escape -> close account view
                    e.preventDefault();
                    scope.state.account.toggle(false);

                } else if (e.keyCode === 27 && scope.state.nav.open) {
                    // escape -> close nav view
                    e.preventDefault();
                    scope.state.nav.toggle(false);
                }

                scope.$apply();
            });
        };
    });

    return NavigationCtrl;
});