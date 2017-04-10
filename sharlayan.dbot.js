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

    var guildId = api._discord.channels[data.channelID].guild_id;
    var server = api._discord.servers[guildId];

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
            var role = resolveRole(guildId, server, desiredRole);

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
            var role = resolveRole(guildId, server, desiredRole);

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
                            "serverID": guildId,
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

            var users = [];
            for (var id in server.members) {
                var member = server.members[id], user = api._discord.users[id];

                console.log(member, user);

                // Skip members with undesirable status, if specified
                if (!checkStatus(member, desiredStatus))
                    continue;

                if (member.roles.length == 0) {
                    users.push(id);
                }
            }
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
        default: {
            ;
            console.log(data);
            break;
        }
    }
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
        api.Events.on("chatCmd", handleCommands);
    },
    stop: function () {
        api.Events.removeListener("chatCmd", handleCommands);
    }
}
