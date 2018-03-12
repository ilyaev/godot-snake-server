const getCollection = colName => {
    return new Promise((resolve, reject) => {
        MongoClient = require('mongodb').MongoClient
        const mUrl = 'mongodb://127.0.0.1:27017'
        MongoClient.connect(mUrl)
            .then(client => {
                console.log('Connected to MongoDB')
                db = client.db('snake')
                collection = db.collection(colName)
                collection.db = db
                process.on('SIGTERM', () => {
                    console.log('Disconnect from mongoDB')
                    client.close()
                    process.exit()
                })
                process.on('SIGINT', () => {
                    console.log('Disconnect from mongoDB')
                    client.close()
                    process.exit()
                })
                resolve(collection)
            })
            .catch(e => {
                console.log('DB ERROR: ', e)
                reject(e)
            })
    })
}

module.exports = {
    getCollection
}
