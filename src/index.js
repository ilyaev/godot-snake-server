var getCollection = require('./db').getCollection
var dateFormat = require('dateformat')
var fs = require('fs')
const { GraphQLServer } = require('graphql-yoga')

const typeDefs = fs.readFileSync(__dirname + '/schema.gql', 'utf8')

const opts = {
    port: 4000 //configurable port no
}

var scoreCollection = false
var userCollection = false

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
            return scoreCollection
                .find()
                .sort({ score: -1 })
                .limit(3)
                .toArray()
                .then(all => {
                    return [
                        {
                            caption: 'Alltime',
                            rows: all
                        },
                        {
                            caption: 'Today',
                            rows: all
                        },
                        {
                            caption: 'Last Week',
                            rows: all
                        }
                    ]
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

            userCollection
                .find({ userid: args.userid })
                .limit(1)
                .toArray()
                .then(records => {
                    if (records[0]) {
                        userCollection.update({ _id: records[0]._id }, { $set: record })
                    } else {
                        record.created = dateFormat(new Date(), 'dddd, mmmm dS, yyyy, h:MM:ss TT')
                        record.createdStamp = Date.now()
                        userCollection.insert(record)
                    }
                })
                .catch(e => {
                    console.log('DB ERROR - ', e)
                })
            return record
        }
    }
}

const server = new GraphQLServer({ typeDefs, resolvers, opts })
server.start(() => console.log(`Server is running at http://localhost:${opts.port}`))
