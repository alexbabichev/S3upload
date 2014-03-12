/* --------------------------------------------------------------------------------------------------------- */

/* --------------------------------------------------------------------------------------------------------- */

var Knox = Npm.require("knox");
var Future = Npm.require('fibers/future');
var http = Npm.require('http');
var fs = Npm.require('fs');
var streamBuffers = Npm.require("stream-buffers");

var knox;
var S3;

/* --------------------------------------------------------------------------------------------------------- */

Meteor.methods({
	
	/* ------------------------------------------------------------------------------------------------------- */

	S3config: function(obj){
		knox = Knox.createClient(obj);
		S3 = {directory:obj.directory || "/"};
	},
	
	/* ------------------------------------------------------------------------------------------------------- */
	
	S3upload: function(options){
	
		var user_id = this.userId;
		var file = options.file,
    		context = options.context,
				callback = options.callback,
				title = options.title || '';
				
    var file_id = S3files.insert({
    		name: file.name, 
    		metadata: { 
    			mime_type: file.type,
    			size: file.size,
    			type: options.type,
    			doc_id: options.doc_id
    		}, 
    		user: user_id,
    		title: title
		});

		var folder = (options.folder) ? folder = options.folder + '/' : '',
				extension = (file.name).match(/\.[0-9a-z]{1,5}$/i),
				path = S3.directory + folder + file_id + extension;
    
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
        S3files.update({_id: file_id}, {$set: {percent_uploaded: progress.percent}});
      })
    );

    put.on('error', Meteor.bindEnvironment(function(error){
        S3files.update({_id: file_id}, {$set: {error: true}});
        throw new Meteor.Error(500, 'Internal Server Error', error);
      })
    );    

    var url = knox.http(future.wait());
    if(url != null){
      S3files.update({_id: file_id}, {$set: {url: url, path: path}});
      if(typeof callback == 'string'){
        Meteor.call(callback, url, context);
      }
      return url;
    }

	},

	/* ------------------------------------------------------------------------------------------------------- */
	
	S3thumbnail: function(options){
		
		var filename = (options.url).split('/');
				src_id = ((filename[filename.length-1]).split('.'))[0],
				filename = 'thumbnail_'+filename[filename.length-1],
				folder = (options.folder) ? folder = options.folder + '/' : '',
				path = S3.directory + folder + filename;
		
		var future = new Future();
		
		http.get(options.url, function(res){
		  
		  var body = '',
		  		buffer = new Buffer("", "binary"),
					headers = {
		      	'Content-Length': res.headers['content-length'],
						'Content-Type': res.headers['content-type']
					};	
	    
		  res.on('data', function(chunk){
			  	 buffer = Buffer.concat([buffer, chunk]);
		  }); 
		  res.on('end', function(){
		  	future.return(buffer);
		  });

		}).on('error', function(e) {
			console.log("Got error: " + e.message);
		});

		var data = future.wait();
    if (data != null){
		    Imagemagick.resize({
		       srcData: data,
		       dstPath: filename, 
		       width: options.width,
		       height: options.height
		    });
		    var put = knox.putFile(filename, path, function(err, res){
		    	if (err) console.log(err);
		    });
    }
    
    var temp = (options.url).split('/');
    		temp = temp[0]+temp[1]+'//'+temp[2]+path;
    		
    console.log(src_id);
    
    S3files.update({_id: src_id}, {$set: {th_url: temp}});
    
    return temp;
	},

	/* ------------------------------------------------------------------------------------------------------- */
	
	S3upload_from_http: function(options){
	
	},

	/* ------------------------------------------------------------------------------------------------------- */
	
	S3upload_from_path: function(options){
	
		// options = { file_path, filename, folder, type, title }

		var user_id = this.userId;
		var file_path = options.file_path,
				title = options.title || '';
		
		var name = (file_path.split('/'));
				name = name[name.length-1];

    var file_id = S3files.insert({
    		name: name, 
    		metadata: { 
    			type: options.type,
    			doc_id: options.doc_id
    		}, 
    		user: user_id,
    		title: title
		});

		var folder = (options.folder) ? folder = options.folder + '/' : '',
				extension = (file_path).match(/\.[0-9a-z]{1,5}$/i),
				path = S3.directory + folder + file_id + extension;

		var future = new Future();

		var put = knox.putFile(file_path, path, function(error, res){
      if(res)
        future.return(path);
			else  
      	throw new Meteor.Error(500, 'Internal Server Error', error);
    }); 
		
    put.on('progress', Meteor.bindEnvironment(function(progress){
        S3files.update({_id: file_id}, {$set: {percent_uploaded: progress.percent}});
      })
    );

    put.on('error', Meteor.bindEnvironment(function(error){
        S3files.update({_id: file_id}, {$set: {error: true}});
        throw new Meteor.Error(500, 'Internal Server Error', error);
      })
    );

    var url = knox.http(future.wait());
    if(url != null){
      S3files.update({_id: file_id}, {$set: {url: url, path: path}});
      if(typeof callback == 'string'){
        Meteor.call(callback, url, context);
      }
      return url;
    }
		
	},

	/* ------------------------------------------------------------------------------------------------------- */
	
	S3delete: function(file_id, callback){
		var path = file.user + "/" + file.file_name;
		S3files.remove({_id: file_id});
		knox.deleteFile(path, function(error, data) {
			if (!error)
				Meteor.call(callback);
			else throw new Meteor.Error(500, 'Internal Server Error');
		});
	},

	/* ------------------------------------------------------------------------------------------------------- */
	
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

/* --------------------------------------------------------------------------------------------------------- */
