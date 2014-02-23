
var Knox = Npm.require("knox");
var Future = Npm.require('fibers/future');
var http = Npm.require('http');
var fs = Npm.require('fs');

var knox;
var S3;

Meteor.methods({
	S3config: function(obj){
		knox = Knox.createClient(obj);
		S3 = {directory:obj.directory || "/"};
	},
	
	S3upload: function(fileInfo, fileData, metadata){
		
		var file_id = Files.insert({name: fileInfo.name, metadata: metadata});
		
		var folder = ''; if (metadata.folder) folder = metadata.folder + '/',
				extension = (fileInfo.name).match(/\.[0-9a-z]{1,5}$/i),
				S3path = S3.directory+folder+file_id+extension;

		var dir = '../../../../../tmp/',
				temp_name = dir + file_id;
					
		fs.writeFile(temp_name, fileData, {encoding: 'binary'}, function(){
			var put = knox.putFile(temp_name, S3path, function(err, res){
				res.resume();
			});
			put.on('progress', function(res){
				Files.update({_id: file_id}, {$set: {res: res}});
			});
			put.on('error', function(error){
				throw new Meteor.Error(500, 'Internal Server Error', error);
			});			
		});
		
		return file_id;
	},
	
	S3upload_from_path: function(){
		
		var file_id = Files.insert({name: filename, metadata: metadata});

		var extension = (filename).match(/\.[0-9a-z]{1,5}$/i);
		var S3path = S3.directory+file_id+extension;		

		var put = knox.putFile(file_path, S3path, function(err, res){
			res.resume();
		});
		put.on('progress', function(res){
			Files.update({_id: file_id}, {$set: {res: res}});
		});
		put.on('error', function(error){
			throw new Meteor.Error(500, 'Internal Server Error', error);
		});
	},
	
	S3delete: function(path, callback){
		knox.deleteFile(path, function(error, data) {
			if (!error)
				future.return(data);
			else throw new Meteor.Error(500, 'Internal Server Error');
		});
		if(future.wait()){
			return future.wait();
		}
	},
	
	S3list: function(){
		var future = new Future();
		knox.list({ prefix: 'my-prefix' }, function(error, data){
			if (!error)
				future.return(data);
			else throw new Meteor.Error(500, 'Internal Server Error');
		});
		if(future.wait()){
			return future.wait();
		}
	}
	
});