/**
 * Created by Arthur on 4/1/2017.
 */
var api;
var commandArgs;
var guildID, server;
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

    guildID = api._discord.channels[data.channelID].guild_id;
    server = api._discord.servers[guildID];

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
            var role = getRole(guildID, server, desiredRole);

            if (data.args.length >= 2)
                desiredStatus = data.args[1].toLowerCase();

            if (role) {
                var users = findMembers(server, function(member, user) {
                    // Skip members with undesirable status, if specified
                    if (!checkStatus(member, desiredStatus))
                        return false;
                    return member.roles.indexOf(role.id) != -1;
                });
                if (users.length > 0)
                    api.Messages.send(data.channelID, `I found ${users.length} users with the role '${role.name}'. They are: <@${users.join(">, <@")}>`);
                else
                    api.MessageKs.send(data.channelID, `I found no users with the role '${role.name}'.`);
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
                var userId = data.args[0], matchExact = false, all = true;

                if (data.args.length > 1)
                    matchExact = data.args[1] === "true";
                if (data.args.length > 2)
                    all = data.args[2] === "true";
                targetUser = resolveUser(userId, matchExact, all);
            }

            if (targetUser instanceof Array) {
                var message = "";

                for (var i in targetUser) {
                    var cMember = server.members[targetUser[i]];
                    message += `<@${targetUser[i]}> has been on the server for ${diffDays(new Date(), new Date(cMember.joined_at))} day(s).\r\n`;
                }
                api.Messages.send(data.channelID, message.trim());
            } else {
                member = server.members[targetUser];
                if (member) {
                    api.Messages.send(data.channelID, `<@${targetUser}> has been on the server for ${diffDays(new Date(), new Date(member.joined_at))} day(s).`);
                } else {
                    api.Messages.send(data.channelID, `I found no user with that name.`);
                }
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
                            }, (function (pruneData, channelID) {
                                return function (error, response) {
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
        case "todo": {
            if (data.args.length == 0) {
                api.Messages.send(data.channelID, "!todo [add | remove | update | list | clear]");
            }
            else {
                var subcommand = data.args.shift().toLowerCase();
                var todoState = new ToDoState(get(server.id, "todo"));
                if (todoState.userID && todoState.userID != data.userID) {
                    api.Messages.send(data.channelID, `To-Do List locked by <@${todoState.userID}>.`);
                    return;
                }
                switch (subcommand) {
                    case "+":
                    case "a":
                    case "add": {
                        if (data.args.length > 0) {
                            todoState.list.push(data.args.join(' '));
                            api.Messages.send(data.channelID, "Your entry has been added.");
                        }
                        else
                            api.Messages.send(data.channelID, "!todo add Something");
                        break;
                    }
                    case "-":
                    case "r":
                    case "rem":
                    case "remove": {
                        if (todoState.list.length == 0) {
                            api.Messages.send(data.channelID, `The To-Do List is empty. =3`);
                        } else {
                            if (data.args.length > 0) {
                                var index = parseInt(data.args[0]);
                                try {
                                    todoState.remove(index);
                                } catch (e) {
                                    if (e instanceof ToDoException && e instanceof ToDoSuccess) {
                                        api.Messages.send(data.channelID, e.message);
                                    } else {
                                        throw e;
                                    }
                                }
                            } else {
                                api._discord.sendMessage({
                                    to: data.channelID,
                                    message: `Select which entry to delete\r\n${todoState.visualizeList(data.userID)}`,
                                    tts: false,
                                    typing: false
                                }, function (error, response) {
                                    var todoState = new ToDoState(get(server.id, "todo"));
                                    if (!error) {
                                        todoState.channelID = response.channel_id;
                                        todoState.menuId = response.id;
                                        todoState.state = "remove"
                                    } else {
                                        todoState.state = "idle";
                                    }
                                    set(server.id, "todo", todoState);
                                });
                            }
                        }
                        break;
                    }
                    case "l":
                    case "list": {
                        if (todoState.list.length == 0) {
                            api.Messages.send(data.channelID, `The To-Do List is empty. =3`);
                        } else {
                            api.Messages.send(data.channelID, todoState.visualizeList());
                        }
                        break;
                    }
                    case "update": {
                        if (data.args.length < 2) {
                            api.Messages.send(data.channelID, `Usage: !todo update # "Stuff"`);
                        } else {
                            var index = data.args.shift();
                            if (!/\d+/.test(index)) {
                                api.Messages.send(data.channelID, `${index} is not a valid position`);
                            } else {
                                index = parseInt(index);
                                if (!todoState.hasIndex(index - 1)) {
                                    api.Messages.send(data.channelID, `${index} is not a valid position`);
                                } else {
                                    var task;
                                    if (data.args.length > 1) {
                                        task = data.args.join(" ");
                                    } else {
                                        task = data.args.shift();
                                    }
                                    var oldTask = todoState.list[index - 1];
                                    todoState.list[index - 1] = task;
                                    api.Messages.send(data.channelID, `Replaced task #${index} with "${task}".`);
                                }
                            }
                        }
                        break;
                    }
                }
                console.log(todoState);
                set(server.id, "todo", todoState);
            }
            break;
        }
        case "resolve": {
            if (data.args.length == 0) {
                api.Messages.send(data.channelID, `Insufficient arguments.`);
            } else {
                var mode = data.args.shift();
                switch (mode) {
                    case "user": {
                        var userId = data.args[0];
                        var matchExact = false, all = false;
                        if (data.args.length > 1)
                            matchExact = data.args[1] === "true";
                        if (data.args.length > 2)
                            all = data.args[2] === "true";
                        var resolvedUser = resolveUser(userId, matchExact, all);
                        console.log(resolvedUser);
                        if (resolvedUser instanceof Array) {
                            resolvedUser = resolvedUser.join(', ');
                        }
                        api.Messages.send(data.channelID, `resolveRole('${userId}', '${matchExact}', '${all}') = ${resolvedUser}`);
                        break;
                    }
                    case "role": {
                        var roleId = data.args[0];
                        var matchExact = false, all = false;
                        if (data.args.length > 1)
                            matchExact = data.args[1] === "true";
                        if (data.args.length > 2)
                            all = data.args[2] === "true";
                        var resolvedRole = resolveRole(roleId, matchExact, all);
                        console.log(resolvedRole);
                        if (resolvedRole instanceof Array) {
                            resolvedRole = resolvedRole.join(', ');
                        }
                        api.Messages.send(data.channelID, `resolveRole('${roleId}', '${matchExact}', '${all}') = ${resolvedRole}`);
                    }
                }
            }
            break;
        }
        case "log": {
            if (data.args.length <= 1) {
                api.Messages.send(data.channelID, `Insufficient arguments.`);
            } else {
                var mode = data.args.shift();
                var snowflake = data.args.shift();
                switch (mode) {
                    case "role": {
                        console.log(server.roles[snowflake]);
                        sendRole(snowflake, data.channelID);
                        break;
                    }
                    case "user": {
                        console.log(api._discord.users[snowflake])
                        break;
                    }
                    case "member": {
                        console.log(server.members[snowflake]);
                        break;
                    }
                }
            }
            break;
        }
        case "find": {
            if (data.args.length <= 1) {
                api.Messages.send(data.channelID, `Insufficient arguments.`);
            } else {
                var mode = data.args.shift();
                var searchTerm = data.args.shift(), index = 0;
                if (data.args.length >= 1) {
                    index = parseInt(data.args.shift()) - 1;
                }
                switch (mode) {
                    case "role": {
                        var resolvedRole = resolveRole(searchTerm, false, true);
                        // TODO: Menu to display choices
                        if (resolvedRole instanceof Array) {
                            if (0 <= index && index < resolvedRole.length) {
                                sendRole(resolvedRole[index], data.channelID);
                            } else {
                                sendRole(resolvedRole[0], data.channelID);
                            }
                        } else {
                            sendRole(resolvedRole, data.channelID);
                        }
                        break;
                    }
                }
            }
            break;
        }
        case "fetch": {
            if (data.args.length <= 1) {
                api.Messages.send(data.channelID, `Insufficient arguments.`);
            } else {
                var mode = data.args.shift();
                var searchTerm = data.args.shift(), index = 0;
                if (data.args.length >= 1) {
                    index = parseInt(data.args.shift()) - 1;
                }
                switch (mode) {
                    case "role": {
                        var resolvedRole = resolveRole(searchTerm, true);
                        sendRole(resolvedRole, data.channelID);
                        break;
                    }
                }
            }
            break;
        }
        case "report":
        {
            if (data.args.length < 1) {
                api.Messages.send(data.channelID, `Insufficient arguments.`);
            } else {
                var mode = data.args.shift();
                switch (mode) {
                    case "soujiReport": {
                        soujiReport(data.channelID);
                        break;
                    }
                }
            }
            break;
        }
        default: {
            console.log(data);
            break;
        }
    }
}

function ToDoSuccess(message) {
    this.message = message;
};

function ToDoException(message) {
    this.message = message;
};

function ToDoState(oldState) {
    this.userID = (oldState && oldState.userID) ? oldState.userID : null;
    this.list = (oldState && oldState.list) ? oldState.list : [];
    this.state = (oldState && oldState.state) ? oldState.state : "idle";
    this.channelID = (oldState && oldState.channelID) ? oldState.channelID : null;
    this.menuId = (oldState && oldState.menuId) ? oldState.menuId : null;

    this.remove = function (index) {
        index -= 1;
        if (!this.hasIndex(index)) {
            throw new ToDoException("There is no task at that position.");
        } else {
            var item = this.list.splice(index, 1);
            throw new ToDoSuccess(`Removed ${index + 1}. ${item}`);
        }
    }

    this.hasIndex = function (index) {
        return 0 <= index && index < this.list.length;
    };

    this.visualizeList = function (userID) {
        if (userID) {
            this.userID = userID;
        }
        // Header
        var message = `To-Do List\r\n`;
        for (var i = 0; i < this.list.length; i++) {
            message += `${i + 1}. ${this.list[i]}\r\n`;
        }
        return message.trim();
    };

    this.handle = function (response) {
        if (!this.menuId)
            return;
        var response = response.trim().toLowerCase();
        if (/\d+/.test(response)) {
            var index = parseInt(response);
            try {
                this.remove(index);
            } catch (e) {
                if (e instanceof ToDoException) {
                    throw e;
                } else {
                    api._discord.deleteMessage({
                        channelID: this.channelID,
                        messageID: this.menuId
                    }, function (error, response) {
                        todoState = new ToDoState(get(server.id, "todo"));
                        todoState.state = "idle"
                        if (!error) {
                            todoState.channelID = null;
                            todoState.menuId = null;
                        }
                        set(server.id, "todo", todoState);
                    });
                    throw e;
                }
            }
        } else {
            switch (response) {
                case "c":
                case "cancel":
                    throw 'Remove cancelled.'
                    break;
            }
        }
    }
}

function handleMessage(messageData) {
    var guildID = api._discord.channels[messageData.channelID].guild_id;
    var server = api._discord.servers[guildID];
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

    var todoState = new ToDoState(get(server.id, "todo"));
    if (todoState && todoState.state == "remove" && todoState.userID == messageData.userID) {
        try {
            todoState.handle(messageData.message);
        } catch (e) {
            if (e instanceof ToDoException || e instanceof ToDoSuccess) {
                api.Messages.send(messageData.channelID, e.message);
            } else {
                throw e;
            }
        }
    }
}

var roleMentionRegex = /(?:<@&)?(\d+)>?/;
function resolveRole(roleIdentifier, matchExact, all) {
    if (!matchExact) {
        matchExact = false;
        roleIdentifier = roleIdentifier.toLowerCase();
    }
    if (!all) {
        all = false;
    }

    var allResults = [];
    if (typeof roleIdentifier === "string") {
        var matchedRole = roleMentionRegex.exec(roleIdentifier);
        if (matchedRole) {
            return matchedRole.pop();
        } else {
            for (var id in server.roles) {
                var currentRole = server.roles[id];
                if (matchExact) {
                    if (currentRole.name === roleIdentifier) {
                        if (!all)
                            return id;
                        allResults.push(id);
                    }
                } else {
                    var roleName = currentRole.name.toLowerCase();
                    if (roleName.startsWith(roleIdentifier) || roleName.indexOf(roleIdentifier) > -1) {
                        if (!all)
                            return id;
                        allResults.push(id);
                    }
                }
            }
        }
        if (allResults.length == 1)
            return allResults[0];
        return allResults;
    } else if (roleIdentifier instanceof Array) {
        var returnValue = [];
        for (var i in roleIdentifier) {
            returnValue[i] = resolveUser(roleIdentifier[i], matchExact, all);
        }
        return returnValue;
    }
}

var userMentionRegex = /(?:<@)?(\d+)>?/;
function resolveUser(userIdentifier, matchExact, all) {
    userIdentifier = userIdentifier.split('#').shift();
    if (!matchExact) {
        matchExact = false;
        userIdentifier = userIdentifier.toLowerCase();
    }
    var allResults = [];
    if (typeof userIdentifier === "string") {
        var matchedUser = userMentionRegex.exec(userIdentifier);
        if (matchedUser) {
            if (!all)
                return matchedUser.pop();
            allResults.push(matchedUser.pop());
        } else {
            for (var id in server.members) {
                var currentMember = server.members[id], currentUser = api._discord.users[id];
                if (matchExact) {
                    if (currentMember.nick && currentMember.nick == userIdentifier) {
                        if (!all)
                            return currentMember.id;
                        if (allResults.indexOf(currentMember.id) == -1)
                            allResults.push(currentMember.id);
                    } else if (currentUser.username == userIdentifier) {
                        if (!all)
                            return currentUser.id;
                        if (allResults.indexOf(currentUser.id) == -1)
                            allResults.push(currentUser.id);
                    }
                } else {
                    if (currentMember.nick) {
                        var nickname = currentMember.nick.toLowerCase();
                        if (nickname.startsWith(userIdentifier) || nickname.indexOf(userIdentifier) > -1) {
                            if (!all)
                                return currentMember.id;
                            if (allResults.indexOf(currentMember.id) == -1)
                                allResults.push(currentMember.id);
                        }
                    } else {
                        var username = currentUser.username.toLowerCase();
                        if (username.startsWith(userIdentifier) || username.indexOf(userIdentifier) > -1) {
                            if (!all)
                                return currentUser.id;
                            if (allResults.indexOf(currentUser.id) == -1)
                                allResults.push(currentUser.id);
                        }
                    }
                }
            }
        }
        if (allResults.length == 1)
            return allResults[0];
        return allResults;
    } else if (userIdentifier instanceof Array) {
        var returnValue = [];
        for (var i in userIdentifier) {
            returnValue[i] = resolveUser(userIdentifier[i], matchExact, all);
        }
        return returnValue;
    }
};

function sendRole(roleSnowflake, channel) {
    var role = server.roles[roleSnowflake];
    if (!role)
        return;
    var membersTotal = findMembers(server, function (member, user) {
        return member.roles.indexOf(role.id) > -1;
    });

    var desiredStatuses = ['online', 'idle', 'dnd']
    var membersOnline = findMembers(server, function (member, user) {
        return member.roles.indexOf(role.id) > -1 && desiredStatuses.indexOf(member.status) > -1;
    });

    api._discord.sendMessage({
        to: channel,
        tts: false,
        typing: false,
        embed: {
            title: "",
            type: "rich",
            color: role.color,
            fields: [
                {
                    "name": "Name",
                    "inline": true,
                    "value": `${role.name}`
                },
                {
                    "name": "ID",
                    "inline": true,
                    "value": `${role.id}`
                },
                {
                    "name": "Created On",
                    "inline": false,
                    "value": new Date((role.id / 4194304) + 1420070400000).toISOString()
                },
                {
                    "name": "Members",
                    "inline": true,
                    "value": `${membersTotal.length} (${membersOnline.length} online)`
                },
                {
                    "name": "Position",
                    "inline": true,
                    "value": `${role.position} (out of ${Object.keys(server.roles).length})`
                },
                {
                    "name": "Color",
                    "inline": true,
                    "value": `Hex: #${padLeft(role.color.toString(16).toUpperCase(), 6, "0")}\r\nDec: ${role.color}`
                },
                {
                    "name": "Hoisted",
                    "inline": true,
                    "value": `${role.hoist}`
                },
                {
                    "name": "Managed",
                    "inline": true,
                    "value": `${role.managed}`
                },
                {
                    "name": "Mentionable",
                    "inline": true,
                    "value": `${role.mentionable}`
                }
            ]
        }
    });
}

//http://stackoverflow.com/questions/5366849/convert-1-to-0001-in-javascript
function padLeft(nr, n, str) {
    return Array(n - String(nr).length + 1).join(str || '0') + nr;
}

function soujiReport(channel) {
    var report = {
        "Genders": [
            {
                label: "Male",
                role: "292968648761409537"
            },
            {
                label: "Female",
                role: "292968723839582208"
            },
            {
                label: "Non-binary",
                role: "292968787811106816"
            },
            {
                label: "Agender",
                role: "294746294092693515"
            },
            {
                label: "Trans",
                role: "292968971463032833"
            },
            {
                label: "All",
                role: ["292968648761409537", "292968723839582208", "292968787811106816", "294746294092693515" ,"292968971463032833"]
            }
        ],
        "Orientations": [
            {
                label: "Gay",
                role: ["293579476162576394", "293579443497074689", "292993054842028032"]
            },
            {
                label: "Bisexual/Pansexual",
                role: ["293583037504159745", "293579840324632579", "293579503920480257", "292993236681752577"]
            },
            {
                label: "Asexual",
                role: "292993340234792960"
            },
            {
                label: "Straight",
                role: ["293580341875310593", "292993148051914772"]
            }
        ],
        "NSFW":[
            {
                label: "NSFW",
                role: ["293580341875310593", "293583037504159745", "293579840324632579", "293579476162576394", "293579503920480257", "293579443497074689"]
            }]
    };

    function findWithRole(roleSnowflake) {
        return findMembers(server, function (member, user) {
            return member.roles.indexOf(roleSnowflake) > -1;
        }).length;
    }

    function recursiveFill(parent) {
        for(var key in parent) {
            if (key === "role") {
                parent.total = 0;
                parent.roleNames = [];
                if (parent[key] instanceof Array) {
                    for (var i in parent[key]) {
                        parent.total += findWithRole(parent[key][i]);
                        parent.roleNames.push(server.roles[parent[key][i]].name)
                    }
                } else {
                    parent.total = findWithRole(parent[key]);
                    parent.roleNames.push(server.roles[parent[key]].name)
                }
                parent.roleNames = parent.roleNames.join("; ")
            }
            else if ((parent.hasOwnProperty(key) && parent[key] instanceof Array) || parent instanceof Array) {
                recursiveFill(parent[key]);
            }
        }
    }
    recursiveFill(report);

    var data = "Roles,Members\r\n";
    for (var i in report) {
        for (var j in report[i]) {
            var dataObj = report[i][j];
            data += `${dataObj.label},${dataObj.total}\r\n`;
        }
    }

    var buffer = Buffer.from(data, "utf8");
    api._discord.uploadFile({
        to: channel,
        message: "_♪ This is the Souji Report, gives you the long and the short! ♪_\r\n_♪ Every grunt, roar, and snort. Not a tale I distort! ♪_\r\n_♪ This is the Souji Re-port! ♪_",
        file: buffer,
        filename: `Sharlayan Census ${(new Date()).toISOString().slice(0, 16).replace(/T/g, " ")}.csv`
    });
}

function _blockletter(message) {
    message = message.toLowerCase();
    var completeMessage = "";
    for (var i = 0; i < message.length; i++) {
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

function getRole(guildId, server, roleIdentifier) {
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
