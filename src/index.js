var getCollection = require('./db').getCollection
var dateFormat = require('dateformat')

var fs = require('fs')
var date = require('date-and-time')

const { GraphQLServer } = require('graphql-yoga')

const typeDefs = fs.readFileSync(__dirname + '/schema.gql', 'utf8')

function toTimestamp(strDate) {
    var datum = Date.parse(strDate)
    return datum
}

const opts = {
    port: 4000 //configurable port no
}

var scoreCollection = false
var userCollection = false

const getScores = (from = false, caption = 'Alltime', limit = 5) => {
    return scoreCollection
        .find(from ? { timestamp: { $gt: from } } : {})
        .sort({ score: -1 })
        .limit(limit)
        .toArray()
        .then(all => {
            var res = {
                caption: caption,
                rows: all
            }
            return res
        })
}

const ordinal_suffix_of = i => {
    var j = i % 10,
        k = i % 100
    if (j == 1 && k != 11) {
        return i + 'st'
    }
    if (j == 2 && k != 12) {
        return i + 'nd'
    }
    if (j == 3 && k != 13) {
        return i + 'rd'
    }
    return i + 'th'
}

getCollection('highscore')
    .then(result => {
        scoreCollection = result
        userCollection = result.db.collection('user')
    })
    .catch(console.log)

const resolvers = {
    Query: {
        hello: (_, { name }) => {
            const returnValue = !name ? `Hello ${name || 'World!'}` : null
            return returnValue
        },
        highscore: (parent, args) => {
            return scoreCollection
                .find()
                .sort({ score: -1 })
                .limit(10)
                .toArray()
                .then(all => {
                    return all
                })
        },
        highscoreSnapshot: (parent, args) => {
            return Promise.all([
                getScores(),
                getScores(toTimestamp(date.addDays(new Date(), -7).toDateString()), 'Last Week'),
                getScores(toTimestamp(date.addDays(new Date(), -30).toDateString()), 'Last Month')
            ]).then(values => values)
        },
        rankByScore: (parent, args) => {
            const score = args.score
            return scoreCollection.count({ score: { $gt: score } }).then(count => {
                return {
                    rank: count + 1,
                    rankText: ordinal_suffix_of(count + 1)
                }
            })
        }
    },
    Mutation: {
        newScore: (parent, args) => {
            const record = {
                name: args.name,
                time: dateFormat(new Date(), 'dddd, mmmm dS, yyyy, h:MM:ss TT'),
                timestamp: Date.now(),
                userid: args.userid,
                score: args.score
            }
            // collection.insert(record)
            scoreCollection.findAndModify({ name: args.name, score: args.score }, [['_id', 'asc']], { $set: record }, { upsert: true })
            // collection.update({ name: args.name, score: args.score }, { $set: record }, { upsert: true })
            return record
        },
        handshake: (parent, args) => {
            const record = {
                userid: args.userid,
                name: args.name,
                lastUpdated: dateFormat(new Date(), 'dddd, mmmm dS, yyyy, h:MM:ss TT'),
                lastUpdateStamp: Date.now()
            }

            return userCollection
                .find({ userid: args.userid })
                .limit(1)
                .toArray()
                .then(records => {
                    if (records[0]) {
                        record.impressions = record.impressions > 0 ? record.impression + 1 : 0
                        userCollection.update({ _id: records[0]._id }, { $set: record })
                        record._id = records[0]._id
                    } else {
                        record.created = dateFormat(new Date(), 'dddd, mmmm dS, yyyy, h:MM:ss TT')
                        record.createdStamp = Date.now()
                        record.impressions = 0
                        record.maxScore = 0
                        userCollection.insert(record).then(one => {
                            record._id = one.ops[0]._id
                        })
                    }
                    return record
                })
                .then(record => {
                    console.log('AGGT!', record)
                    console.log(
                        'Q: ',
                        { $match: { userid: String(record._id) } },
                        { $group: { _id: '$userid', maxScore: { $max: '$score' } } }
                    )
                    return scoreCollection
                        .aggregate([
                            { $match: { userid: String(record._id) } },
                            { $group: { _id: '$userid', maxScore: { $max: '$score' } } }
                        ])
                        .toArray()
                        .then(aggr => {
                            if (aggr[0] && aggr[0].maxScore) {
                                record.maxScore = aggr[0].maxScore
                            } else {
                                record.maxScore = 0
                            }
                            return record
                        })
                })
                .catch(e => {
                    console.log('DB ERROR - ', e)
                })
        }
    }
}

const server = new GraphQLServer({ typeDefs, resolvers, opts })
server.start(() => console.log(`Server is running at http://localhost:${opts.port}`))
