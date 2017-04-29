# discord.sharlayan
Extendable-Discord-Bot for Sharlayan

# Commands

A list of commands

## !findByRole [RoleName | RoleId | RoleMention]
Find all users with a given role.

## !listNoRoles
Find all users without any roles

## !addNoRolesTo [RoleName | RoleId | RoleMention]
Add any users without any roles to the specified role

## !userAge [Username | Nickname | Mention]
Displays how long the user has been on the server, in days.

## !prune Reason
Kicks users with no roles and display a modlog entry.
This command can be cancelled, but users already kicked will remain kicked. Duh.

## !resolve
This command calls the resolve functions

### !resolve user [matchExact = false] [all = false]
Calls resolveUser with the given parameters.

#### user
The user identifier. A username, nickname, or snowflake.

#### matchExact
Setting to match the identifier exactly, or loosely. If set to false, the search will be done with String.startsWith **and** String.indexOf. If set to true, the search is done using ===.

Defaults to false.

#### all
Setting to return an array of matches, or a single match. If set to false, only one result, if any, is returned. If set to true, an array will be returned. If no results are found, the array will be empty.

Defaults to false.

### !resolve role [matchExact = false] [all = false]

#### role
The role identifier. A role name, or snowflake.

#### matchExact
Setting to match the identifier exactly, or loosely. If set to false, the search will be done with String.startsWith **and** String.indexOf. If set to true, the search is done using ===.

Defaults to false.

#### all
Setting to return an array of matches, or a single match. If set to false, only one result, if any, is returned. If set to true, an array will be returned. If no results are found, the array will be empty.

Defaults to false.

## !log
Logs an object to the console.

### !log user snowflake
Logs a user object with the given snowflake to the console

### !log member snowflake
Logs a member object with the given snowflake to the console

### !log role snowflake
Logs a role object with the given snowflake to the console

## !find
Search for an object

### !find role searchTerm index
Search for role matching searchTerm, and return the index'th result.

#### searchTerm
The role to look for

#### index
The position in the list of results to return.

## !fetch
Retrieve an object

### !fetch role roleName
Retrieves the role with roleName and displays it

## !report
Reporting master command

### !report soujiReport
Sharlayan Census.