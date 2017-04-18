/**
 * Created by Arthur on 4/1/2017.
 */
var api;
var commandArgs;

var oneDay = 24 * 60 * 60 * 1000;

/**
 * http://stackoverflow.com/questions/2627473/how-to-calculate-the-number-of-days-between-two-dates-using-javascript
 * @param firstDate The date to subtract from
 * @param secondDate The date to subtract
 * @param setToMidnight True to set both dates to midnight, false to leave time intact
 * @returns {number} The number of days between
 */
function diffDays(firstDate, secondDate, setToMidnight) {
    if (setToMidnight === true) {
        firstDate.setHours(0, 0);
        secondDate.setHours(0, 0);
    }
    return Math.round(Math.abs((firstDate.getTime() - secondDate.getTime()) / (oneDay)));
}

function handleCommands(data) {
    commandArgs = data;

    var guildID = api._discord.channels[data.channelID].guild_id;
    var server = api._discord.servers[guildID];

    if (!server) {
        api.Messages.send(data.channelID, "Couldn't find origin server");
        return;
    }

    switch (data.cmd) {
        case "findbyrole": {
            if (data.args.length == 0) {
                api.Messages.send(data.channelID, "No role to find");
                return;
            }

            var desiredRole = data.args[0], desiredStatus = null;
            var role = resolveRole(guildID, server, desiredRole);

            if (data.args.length >= 2)
                desiredStatus = data.args[1].toLowerCase();

            if (role) {
                var users = [];
                for (var id in server.members) {
                    var member = server.members[id], user = api._discord.users[id];

                    // Skip members with undesirable status, if specified
                    if (!checkStatus(member, desiredStatus))
                        continue;

                    if (member.roles.indexOf(role.id) != -1) {
                        users.push(id);
                    }
                }
                if (users.length > 0)
                    api.Messages.send(data.channelID, `I found ${users.length} users with the role '${role.name}'. They are: <@${users.join(">, <@")}>`);
                else
                    api.Messages.send(data.channelID, `I found no users with the role '${role.name}'.`);
            }
            else {
                api.Messages.send(data.channelID, `No role found. I searched for '${data.args[0]}'`);
            }
            break;
        }
        case "addnorolesto":
        case "addnoroleto": {
            if (data.args.length == 0) {
                api.Messages.send(data.channelID, "No role to add");
                return;
            }

            var desiredRole = data.args[0], desiredStatus = "online";
            var role = resolveRole(guildID, server, desiredRole);

            if (data.args.length >= 2)
                desiredStatus = data.args[1].toLowerCase();

            if (role) {
                var users = [];
                for (var id in server.members) {
                    var member = server.members[id], user = api._discord.users[id];

                    // Skip members with undesirable status, if specified
                    if (!checkStatus(member, desiredStatus))
                        continue;

                    if (member.roles.length == 0) {
                        api._discord.addToRole({
                            "serverID": guildID,
                            "userID": id,
                            "roleID": role.id
                        }, function (info1, info2) {
                            console.log(info1, info2);
                        });
                        users.push(id);
                    }
                }
                if (users.length > 0)
                    api.Messages.send(data.channelID, `I added ${users.length} users to the role '${role.name}'. They are: <@${users.join(">, <@")}>`);
                else
                    api.Messages.send(data.channelID, `I found no users to add to the role '${role.name}'.`);
            }
            else {
                api.Messages.send(data.channelID, `No role found. I searched for '${data.args[0]}'`);
            }
            break;
        }
        case "listnorole":
        case "listnoroles": {
            var desiredStatus = null;
            if (data.args.length >= 1)
                desiredStatus = data.args[0].toLowerCase();

            var users = findMembers(server, function (member, user) {
                // Skip members with undesirable status, if specified
                if (!checkStatus(member, desiredStatus))
                    return false;
                if (member.roles.length == 0)
                    return true;
                ;
                return false;
            });
            if (users.length > 0)
                api.Messages.send(data.channelID, `I found ${users.length} with no roles. They are: <@${users.join(">, <@")}>`);
            else
                api.Messages.send(data.channelID, `I found no users without any roles.`);
            break;
        }
        case "mystatus": {
            api.Messages.send(data.channelID, `Status is: ${server.members[data.userID].status}`);
            break;
        }
        case "userage": {
            var member;
            var targetUser = data.userID;

            if (data.args.length >= 1) {
                targetUser = data.args[0];

                var matchedUser = /(?:<@)?(\d+)>?/.exec(targetUser);
                if (matchedUser) {
                    targetUser = matchedUser.pop();
                } else {
                    for (var id in server.members) {
                        var currentMember = server.members[id], currentUser = api._discord.users[id];
                        if (currentMember.nick && currentMember.nick == targetUser) {
                            targetUser = currentMember.id;
                            break;
                        } else if (currentUser.username == targetUser) {
                            targetUser = currentUser.id;
                            break;
                        }
                    }
                }
            }

            member = server.members[targetUser];
            if (member) {
                api.Messages.send(data.channelID, `<@${targetUser}> has been on the server for ${diffDays(new Date(), new Date(member.joined_at))} day(s).`);
            } else {
                api.Messages.send(data.channelID, `I found no user with that name.`);
            }
            break;
        }
        case "prune": {
            var pruneData = get(data.channelID, "prune");
            if (pruneData) {
                api.Messages.send(data.channelID, `Prune is currently in use by <@${pruneData.user}>. Cannot prune again.`);
                return;
            } else {
                if (data.args == 0) {
                    api.Messages.send(data.channelID, `Format: !prune Reason`);
                    return;
                }
                var pruneReason = data.args[0];
                if (data.args.length > 1)
                    pruneReason = data.args.join(" ");
                pruneData = {
                    user: data.userID,
                    start: new Date(), serverID: guildID,
                    reason: pruneReason,
                    targets: findMembers(server, function (member, user) {
                        return member.roles.length == 0;
                    }),
                    queried: false,
                    index: 0,
                    removed: [],
                    show: function () {
                        if (this.index >= this.targets.length) {
                            var msg = `Pruning complete.`;
                            if (this.removed.length > 0) {
                                msg += `\r\nI successfully removed ${this.removed.length} user(s): <@${this.removed.join(">, <@")}>\r\n`;
                                msg += "``" + `:no_entry_sign: kick | <@${this.removed.join("> | <@")}> | ${this.reason}` + "``";
                            }
                            api.Messages.send(data.channelID, msg);
                            unset(data.channelID, "prune");
                        } else {
                            api._discord.sendMessage({
                                to: data.channelID,
                                message: `[${this.index + 1}/${this.targets.length}] Are you sure you want to kick <@${this.targets[this.index]}>? Enter Yes or No.`,
                                tts: false,
                                typing: false
                            }, (function(pruneData, channelID) {
                                return function(error, response) {
                                    if (!error) {
                                        pruneData.queried = true;
                                        set(channelID, "prune", pruneData);
                                    } else {

                                    }
                                };
                            })(this, data.channelID));
                        }
                    },
                    handle: function (response) {
                        if (!this.queried)
                            return;
                        switch (response.trim().toLowerCase()) {
                            case "y":
                            case "yes":
                                this.queried = false;
                                api._discord.kick({
                                        "serverID": this.serverID,
                                        "userID": this.targets[this.index]
                                    },
                                    (function (context, target) {
                                        return function (error) {
                                            var pruneData = get(context, "prune");
                                            if (pruneData) {
                                                if (!error) {
                                                    pruneData.removed.push(target);
                                                } else {
                                                    api.Messages.send(context, `I failed to kick <@${target}>`);
                                                }
                                                set(data.channelID, "prune", pruneData);
                                                pruneData.show();
                                            }
                                        }
                                    })(data.channelID, this.targets[this.index++]));
                                set(data.channelID, "prune", this);
                                break;
                            case "n":
                                this.queried = false;
                                this.index++;
                                set(data.channelID, "prune", this);
                                this.show();
                                break;
                            case "c":
                            case "cancel":

                                var msg = `Pruning cancelled.`;
                                if (this.removed.length > 0) {
                                    msg += `\r\nI successfully removed ${this.removed.length} user(s): <@${this.removed.join(">, <@")}>\r\n`;
                                    msg += "``" + `:no_entry_sign: kick | <@${this.removed.join("> | <@")}> | ${this.reason}` + "``";
                                }
                                api.Messages.send(data.channelID, msg);
                                unset(data.channelID, "prune");
                                break;
                        }
                    }
                }
                set(data.channelID, "prune", pruneData);
                api.Messages.send(data.channelID, `Found ${pruneData.targets.length} users eligible for pruning.`);
                pruneData.show();
            }
            break;
        }
        case "blockletter": {
            api.Messages.send(data.channelID, _blockletter(data.args.join(' ')));
            break;
        }
        case "at": {
            var strLeft = data.args.shift();
            var strRight = data.args.shift();
            var left, right;
            for (var i in server.emojis) {
                var emoji = server.emojis[i];
                if (emoji.name == strLeft) {
                    left = `:${strLeft}:${emoji.id}`;
                }
                if (emoji.name == strRight) {
                    right = `:${strRight}:${emoji.id}`;
                }
                if (left && right) {
                    break;
                }
            }
            var message = data.args.join(' ');
            api.Messages.send(data.channelID, _atText(left, right, message));
            break;
        }
        case "_set": {
            if (data.args.length == 2)
                set(data.channelID, data.args[0], data.args[1]);
            break;
        }
        case "_get": {
            if (data.args.length >= 1) {
                api.Messages.send(data.channelID, `Value: '${get(data.channelID, data.args[0])}`);
                console.log(get(data.channelID, data.args[0]));
            }
            break;
        }
        default: {
            console.log(data);
            break;
        }
    }
}

function handleMessage(messageData) {
    /*
     {
     username: _username,
     userID: _userID,
     channelID: _channelID,
     message: discord.fixMessage(_message),
     msg: discord.fixMessage(_message),
     message_raw: _message,
     rawEvent: _rawEvent
     }
     */
    // Prune
    var pruneData = get(messageData.channelID, "prune");
    if (pruneData && pruneData.handle && pruneData.user == messageData.userID) {
        // If we're pruning, and the user responding.
        pruneData.handle(messageData.message);
    }
}

function _blockletter(message) {
    message = message.toLowerCase();
    var completeMessage = "";
    for(var i = 0; i < message.length; i++) {
        if (/[a-z]/.test(message[i])) {
            completeMessage += ":regional_indicator_" + message[i] + ": ";
        } else {
            completeMessage += message[i];
        }
    }
    return completeMessage;
}

function _atText(left, right, message) {
    return `<${left}> ${message} <${right}>`
}

function findMembers(server, comparer) {
    var users = [];
    for (var id in server.members) {
        var member = server.members[id], user = api._discord.users[id];

        // console.log(member, user);

        if (comparer(member, user)) {
            users.push(id)
        }
    }
    return users;
}

function get(context, key) {
    return api.sharedStorage.getItemSync(`${context}-${key}`);
}

function set(context, key, value) {
    return api.sharedStorage.setItemSync(`${context}-${key}`, value);
}

function unset(context, key) {
    return api.sharedStorage.removeItemSync(`${context}-${key}`);
}

function log(data) {
    api.Messages.send(commandArgs.channelID, data.toString());
    console.log(data);
}

function resolveRole(guildId, server, roleIdentifier) {
    var role = null;

    var matchedRole = /(?:<@&)?(\d+)>?/.exec(roleIdentifier);
    if (matchedRole) {
        desiredRole = matchedRole[1];
        role = server.roles[desiredRole];
    }
    else {
        for (var roleId in server.roles) {
            var currentRole = api._discord.servers[guildId].roles[roleId];
            if (currentRole.name === roleIdentifier) {
                role = currentRole;
                break;
            }
        }
    }
    return role;
}

function getMemberStatus(member) {
    if (!member.status)
        return "offline";
    return member.status;
}

function checkStatus(member, status) {
    if (!member)
        return false;
    if (!status || status === "all" || status === "any")
        return true;
    return getMemberStatus(member).toLowerCase() == status;
}

module.exports = {
    meta_inf: {
        name: "Sharlayan Commands",
        version: "1.0.0.1",
        description: "Sharlayan Package",
        author: "Emraell"
    },
    load: function (_api) {
        api = _api;
    },
    start: function () {
        // Purge Prune session
        var toPurge = [];
        api.sharedStorage.forEach(function (key) {
            if (/\d+-prune/.test(key))
                toPurge.push(key);
        });
        for (var i in toPurge) {
            api.sharedStorage.removeItemSync(toPurge[i]);
        }
        api.Events.on("chatCmd", handleCommands);
        api.Events.on("message", handleMessage);

    },
    stop: function () {
        api.Events.removeListener("chatCmd", handleCommands);
        api.Events.removeListener("message", handleMessage);
    }
}
