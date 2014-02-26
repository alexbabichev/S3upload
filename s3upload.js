
var Knox = Npm.require("knox");
var Future = Npm.require('fibers/future');
var http = Npm.require('http');
var fs = Npm.require('fs');
var streamBuffers = Npm.require("stream-buffers");

var knox;
var S3;

Meteor.methods({
	S3config: function(obj){
		knox = Knox.createClient(obj);
		S3 = {directory:obj.directory || "/"};
	},
	
	S3upload: function(options){

		var user_id = this.userId;
		var file = options.file,
    		context = options.context,
				callback = options.callback;
				
		var folder = (metadata.folder) ? folder = metadata.folder + '/' : '',
				extension = (fileInfo.name).match(/\.[0-9a-z]{1,5}$/i),
				path = S3.directory + folder + '/' + file_id + extension;
    
		var file_stream_buffer = new streamBuffers.ReadableStreamBuffer({
      	frequency: 10,       	// in milliseconds.
				chunkSize: 2048     	// in bytes.
    });
    
    var future = new Future(),
    		buffer = new Buffer(file.data);

		file_stream_buffer.put(buffer);

    var headers = {
      "Content-Type":		file.type,
      "Content-Length":	buffer.length
    }   
    
		var put = knox.putStream(file_stream_buffer, path, headers, function(error, res){
      if(res)
        future.return(path);
			else  
      	throw new Meteor.Error(500, 'Internal Server Error', error);
    });    
    
    put.on('progress', Meteor.bindEnvironment(function(progress){
        S3files.update({file_name: file.name}, {$set: {percent_uploaded: progress.percent}});
      })
    );

    put.on('error', Meteor.bindEnvironment(function(error){
        S3files.update({file_name: file.name}, {$set: {error: true}});
        throw new Meteor.Error(500, 'Internal Server Error', error);
      })
    );    

    var url = knox.http(future.wait());
    if(url != null){
      S3files.update({file_name: file.name}, {$set: {url: url}});
      if(typeof callback == 'string'){
        Meteor.call(callback, url, context);
      }
    }

	},
	
	S3upload_from_http: function(options){
	
	},
	
	S3upload_from_path: function(options){
		
		var file_id = Files.insert({name: filename, metadata: metadata});

		var folder = (options.folder) ? folder = options.folder + '/' : '',
				extension = (fileInfo.name).match(/\.[0-9a-z]{1,5}$/i),
				path = S3.directory + folder + '/' + file_id + extension;	

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
	
	S3delete: function(file_id, callback){
		var path = file.user + "/" + file.file_name;
		S3files.remove({_id: file_id});
		knox.deleteFile(path, function(error, data) {
			if (!error)
				Meteor.call(callback);
			else throw new Meteor.Error(500, 'Internal Server Error');
		});
	},
	
	S3list: function(path){
		var future = new Future();
		knox.list({ prefix: path }, function(error, data){
			if (!error)
				future.return(data);
			else throw new Meteor.Error(500, 'Internal Server Error');
		});
		if(future.wait()){
			return future.wait();
		}
	}
	
});