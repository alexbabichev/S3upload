Package.describe({
	summary: "Upload files to S3. Allows use of Knox Server-Side."
});

Npm.depends({
	'knox': '0.8.5',
	'stream-buffers': '0.2.5'
});


Package.on_use(function (api) {
	
	api.use(["underscore", "ejson", "service-configuration", "collection-hooks"], ["client", "server"]);
	
	api.add_files('s3upload.js', 'server');
	api.add_files('collection/s3files.js', ['client', 'server']);
	
	api.export && api.export("Knox","server");
	
});