var fs = require('fs')
var getCollection = require('../src/db').getCollection
var dateFormat = require('dateformat')

const users = fs.readFileSync(__dirname + '/users.log', 'utf8').split('\n')
const scores = fs.readFileSync(__dirname + '/score.log', 'utf8').split('\n')

const smap = {}

scores.forEach(one => {
    const parts = one.split('New Score:')
    const raw = parts.slice(-1)[0].trim()
    if (raw) {
        const subparts = raw.split(',')
        const name = subparts[0] ? subparts[0].trim() : ''
        const score = subparts[1] ? subparts[1].trim() : ''
        if (typeof smap[name] === 'undefined') {
            smap[name] = []
        }
        if (smap[name].indexOf(score) === -1 && score !== '0') {
            smap[name].push(score)
        }
    }
})

delete smap['Western']
delete smap['Solid']
delete smap['AgentK']
delete smap['Commando']
delete smap['Terminator']
delete smap['Rookie']

const visitMap = {}
const nameId = {}

const records = users.forEach(one => {
    const parts = one.split(',')
    const id = parts[2] ? parts[2].trim() : ''
    const name = parts[0].split(':')[3] ? parts[0].split(':')[3].trim() : ''
    const ip = parts[1] ? parts[1].trim() : ''
    if (name && id.indexOf('-') === -1) {
        nameId[name] = id
        if (typeof visitMap[id] === 'undefined') {
            visitMap[id] = {
                impressions: 0,
                name: name,
                userid: id,
                ip: ip
            }
        } else {
            visitMap[id]['impressions'] += 1
        }
    }
})

getCollection('user').then(db => {
    Object.keys(visitMap).forEach(id => {
        const user = visitMap[id]
        db
            .find({ userid: id })
            .limit(1)
            .toArray()
            .then(records => {
                if (records[0]) {
                    // console.log(id, ' - found')
                } else {
                    console.log(id, ' - to create')
                    db.insert(user)
                }
            })
    })
})

setTimeout(() => {
    console.log('Continue')
    getCollection('highscore').then(db => {
        Object.keys(smap).forEach(name => {
            const values = smap[name]
            const userid = nameId[name]
            values.forEach(ones => {
                db.insert({
                    name: name,
                    score: parseInt(ones),
                    time: dateFormat(new Date(), 'dddd, mmmm dS, yyyy, h:MM:ss TT'),
                    timestamp: Date.now()
                })
            })
        })
    })
}, 1000)
