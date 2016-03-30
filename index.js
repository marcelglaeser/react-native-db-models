'use strict';

var ReactNativeStore = require('./asyncstore');
var Events = require('eventemitter3')
var _ = require('lodash');
var RNDBModel = {};
RNDBModel.DBEvents = new Events()

RNDBModel.create_db = function(db){
    var me = this;
    me.db_name = db;

    me.sync = (remoteData) => {

        let updatedItems = [];
        let itemsToAdd = [];
        let localUpdates = [];
        let remoteUpdates = [];

        remoteData = remoteData.map((ritem) => {
            ritem._id = ritem._id.replace(/-/g, '');
            return ritem;
        });

        me.get_all(true, function(results) {

            let localItems = _.toArray(results.rows);

            localItems = localItems.map((litem) => {
                litem._id = litem._id.replace(/-/g, '');
                return litem;
            });

            localItems = Object.assign([], localItems);
            
            remoteData.forEach((item) => {

               let index = _.findIndex(localItems, (o) => {
                    return o._id == item._id;
                });

                if(index == -1) {    
                    itemsToAdd.push(item);
                } else {
                    // check updated times

                    const foundItem = localItems[index];

                    if('updatedAt' in item) {
                        
                        if(new Date(foundItem.updatedAt).getTime() !=  item.updatedAt.getTime()) {

                            if(new Date(foundItem.updatedAt).getTime() < item.updatedAt.getTime()) {
                            
                                localUpdates.push(Object.assign(item));

                            }
                            else {
                                remoteUpdates.push(Object.assign(foundItem));

                            }
                        }
                        
                    } 

                    localItems.splice(index, 1);

                }

            });

            // check if theres any remote data to add to local
            if(itemsToAdd.length > 0) {

                me.add_all(itemsToAdd, function(added) {
                    console.log('items added to local: ', added);
                });
            }

            // now go through local and see if there are any to add to remote

            const localItemToAddMaybe = localItems.filter(function (item) {
                let index = _.findIndex(remoteData, (o) => {
                    return o._id == item._id;
                });

                return item !== undefined && index == -1;
            });


            if(localItemToAddMaybe.length > 0) {

                RNDBModel.DBEvents.emit("inserted", me.db_name, localItemToAddMaybe);

            }

            if(localUpdates.length > 0) {

                me.update_all(localUpdates, function(updated) {
                    console.log('items updated in local: ', updated);
                });

            }

             if(remoteUpdates.length > 0) {
                RNDBModel.DBEvents.emit("updated", me.db_name, remoteUpdates);
            }

        });
       

    }

    /**
     * @description Finds all the objects based on the query
     * @param query_data
     * @param callback
     */
    me.get = function(query_data, callback){
        ReactNativeStore.table(me.db_name).then(function(collection){
            var results = collection.where(query_data).find();
            if(callback){
                callback(results)
            }
        });
    };

    /**
     * @description Finds by ID
     * @param id
     * @param callback
     */
    me.get_id = function(id, callback){
        ReactNativeStore.table(me.db_name).then(function(collection){
            var results = collection.get(id);
            if(callback){
                callback(results)
            }
        });
    };

    /**
     * @description Gets all the data of the table
     * @param callback
     */
    me.get_all = function(includeRemoved, callback){
        ReactNativeStore.table(me.db_name).then(function(collection){
            var results = collection.databaseData[me.db_name];
            
            if(!includeRemoved) {
                results.rows =  _.reject(results.rows, (o) => {
                    
                    if('deletedAt' in o) {
                        return true;
                    }
                    return false;

               });
            }
           


            if(callback){
                callback(results)
            }
        });
    };

    /**
     * @description Adds data to the Table in the DB
     * @param data_to_add
     * @param callback
     */
    me.add = function(data_to_add, callback){
        ReactNativeStore.table(me.db_name).then(function(collection){
            // Add Data
            collection.add(data_to_add, function(added_data_id){
                if(callback){
                    callback(added_data_id)
                }
                RNDBModel.DBEvents.emit("all", me.db_name)
            });
        });
    };

    /**
     * @description Adds array of data (objects) to the Table in the DB
     * @param data_to_add
     * @param callback
     */
    me.add_all = function(data_to_add, callback){
        var self = this;

        ReactNativeStore.table(me.db_name).then(function(collection){
            // Add Data
            collection.multiAdd(data_to_add, function(added_data){
                if(callback){
                    callback(added_data)
                }
                RNDBModel.DBEvents.emit("all", me.db_name)
            });
        });
    };

    /**
     * @description Removes all the objects matching the query
     * @param query_data
     * @param callback
     */
    me.remove = function(query_data, callback){
        ReactNativeStore.table(me.db_name).then(function(collection){
            collection.where(query_data).remove(function(data_removed){
                if(callback){
                    callback(data_removed);
                }
            });
        });
    };

    /**
     * @description Removed object by ID
     * @param id
     * @param callback
     */
    me.remove_id = function(id, callback){
        ReactNativeStore.table(me.db_name).then(function(collection){
            collection.removeById(id, function(data_removed){
                if(callback){
                    callback(data_removed);
                }
                RNDBModel.DBEvents.emit("all", me.db_name)
            });
        });
    };

    /**
     * @description Erases the complete DB
     * @param callback
     */
    me.erase_db = function(callback){
        ReactNativeStore.table(me.db_name).then(function(collection){
            collection.remove(function(data_removed){
                if(callback){
                    callback(data_removed);
                }
                RNDBModel.DBEvents.emit("all", me.db_name)
            });
        });
    }
    /**
     * @description Updates the Table with the query
     * @param query_data
     * @param replace_data
     * @param callback
     */
    me.update = function(query_data, replace_data, callback){
        ReactNativeStore.table(me.db_name).then(function(collection){
            collection.where(query_data).update(replace_data, function(data){
                if(callback){
                    callback(data);
                }
                RNDBModel.DBEvents.emit("all", me.db_name)
            });
        });
    };

    /**
     * @description Updates the DB Object by ID
     * @param id
     * @param replace_data
     * @param callback
     */
    me.update_id = function(id, replace_data, callback){
        ReactNativeStore.table(me.db_name).then(function(collection){
            collection.updateById(id, replace_data, function(data){
                if(callback){
                    callback(data);
                }
                RNDBModel.DBEvents.emit("all", me.db_name)
            });
        });
    };

    /**
     * @description updates array of data (objects) to the Table in the DB
     * @param data_to_update
     * @param callback
     */
    me.update_all = function(data_to_update, callback){
        var self = this;

        ReactNativeStore.table(me.db_name).then(function(collection){
            // Add Data
            collection.multiUpdate(data_to_update, function(updated_data){
                if(callback){
                    callback(updated_data)
                }
                RNDBModel.DBEvents.emit("all", me.db_name)
            });
        });
    };

    /**
     * @description Removed object by ID
     * @param id
     * @param callback
     */
    me.remove_id = function(id, callback){
        ReactNativeStore.table(me.db_name).then(function(collection){
            collection.removeById(id, function(data_removed){
                if(callback){
                    callback(data_removed);
                }
                RNDBModel.DBEvents.emit("all", me.db_name)
            });
        });
    };

};

module.exports = RNDBModel;
