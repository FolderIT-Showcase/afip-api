var colors = require('colors');

module.exports = {
    environment: process.env.NODE_ENV || 'development',
    databases: {
        production: 'mongodb://nodefe-api:SeriesBelowChanceToday@127.0.0.1:27017/nodefe?authSource=user-data',
        development: 'mongodb://172.10.10.200:27017/nodefe'
    },
    tokenSecret: "FindIndustrialRecallEaten",
    rcSecret: '6Les3h8UAAAAAIdyZEB0lXy1zn-G9T_nbHzhZfhB',
    loggerFormat: {
        format: [
            "{{timestamp}} <{{title}}> {{path}}:{{line}} ({{method}})\n{{message}}",
            {
                info: "{{timestamp}} <{{title}}> {{path}}:{{line}} ({{method}})\n{{message}}",
                warn: "{{timestamp}} <{{title}}> {{path}}:{{line}} ({{method}})\n{{message}}",
                error: "{{timestamp}} <{{title}}> {{path}}:{{line}} ({{method}})\n{{message}}",
                debug: "{{timestamp}} <{{title}}> {{path}}:{{line}} ({{method}})\n{{message}}",
                log: "{{timestamp}} <{{title}}> {{file}}:{{line}} ({{method}}) {{message}}"
            }
        ],
        filters: [{
            info: [colors.green, colors.bold],
            warn: [colors.yellow, colors.bold],
            error: [colors.red, colors.bold],
            debug: [colors.cyan, colors.bold],
            log: [colors.white, colors.bold]
        }],
        dateformat: "yyyy-mm-dd HH:MM:ss.L"
    }
};
