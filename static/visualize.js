//making global, as they are referenced in a few functions
//from the zooming map example, looked good,
//but will probably change later
var chartWidth = 960;
var chartHeight = 580;


function HurricaneModel() {
    this.year = ko.observable("2012");
    this.day = ko.observable("25");
    this.month = ko.observable("OCT");
    this.timeOfDay = ko.observable("1200");


	this.date = ko.computed(function() {
	        return this.month() + " " + this.day()+ " "+this.year() 
				+ " "+this.timeOfDay().slice(0,2)+
				":"+this.timeOfDay().slice(2,4);
	    }, this);
	
	
	
}

var viewModel = new HurricaneModel();
ko.applyBindings(viewModel);

$.getJSON('static/usa_state.json', function(usa) {
	$.getJSON('static/hurricane_radii.json', function(hurricaneRadii) {
		$.getJSON('static/hurricane_points.json', function(hurricanePoints) {
			renderMap(usa,hurricaneRadii,hurricanePoints);
			});
		
	});
    
});

function renderMap(usa,hurricaneRadii,hurricanePoints){
	
	var timeList = [];
	var timelinePhotos = [];
	//massage the hurricane points so that we animate by time
	$.each(hurricanePoints.features,function(index,feature){
		timeList.push(feature.properties.DTG);
	
	});
	

   //add a few more points to finish to get more pictures
   timeList.push(2012103006);
   timeList.push(2012103012);
   timeList.push(2012103018);
	
	//sort the time list
	timeList.sort(function(a, b) {
	   return (a < b) ? -1 : (a > b) ? 1 : 0;
	})

   //TODO: adjust to focus on east coast
	var projection = d3.geo.albersUsa()
	    .scale([chartWidth]);

	var path = d3.geo.path()
	    .projection(projection);

	var viz = d3.select("#map").append("svg")
		     .attr("width", chartWidth)
		     .attr("height", chartHeight)
	//create the map of the USA	  
	viz.append("g")
		.selectAll("path")
	    .data(usa.features)
	    .enter().append("path")
	    .attr("d", path)
		.attr("fill","#aaa")
		.attr("stroke","#fff");
	
	//create references for the groups of points and radii 
	//to get access to later	
	var radiiGroup = viz.append("g");
	var pointsGroup = viz.append("g");

	//add the radii to the map, but make them invisible
		radiiGroup
			.selectAll("path")
		    .data(hurricaneRadii.features)
			.enter().append("path")
			.attr("d", path)
			.attr("fill","blue")
			.attr("stroke","white")
			.style("opacity",0);
	//add the points to the map, but make them invisible
		pointsGroup
			.selectAll("path")
		    .data(hurricanePoints.features)
		    .enter().append("path")
			.attr("d", path)
			.attr("fill","black")
			.attr("stroke","black")
			.style("opacity",0);
	
	//create a group to hold all the images
	var imageGroup = viz.append("g");
	
	//set up a timeline on the bottom of the visualization
	var scaleGroup = viz.append("g");
	scaleGroup.attr("transform", "translate(0," + (chartHeight*0.95) + ")")
		
	//create a little box to move along the scale
	var rectGroup = viz.append("g");
	var selectorWidth = 20;
	var selectorHeight = 45;
	
	var minTime = parseDate(timeList[0]);
	var maxTime = parseDate(timeList[timeList.length-1]);
	

	var x = d3.time.scale()
	    		.domain([minTime,maxTime])
				 .range([0, chartWidth*0.95]);
	
	var xAxis=d3.svg.axis()
				    .scale(x)
				    .orient("bottom")
					.ticks(d3.time.days, 1)
					.tickSubdivide(3).tickSize(-30,-15,-30);
	
    var i = 0;
	updateHurricanePosition(timeList[i],pointsGroup,radiiGroup,"forward");
	
	scaleGroup.attr("class", "x axis")
				    .call(xAxis);
	

    //setup the drag behavior of the selector
    //clicking and dragging will allow you to highlight a
   //region you want to zoom in on
	var dragBox = d3.behavior.drag()
	  .on('dragstart', function(){
	    d3.event.sourceEvent.stopPropagation();
	  })
	  .on('drag', function(){
		
		var mouseX = d3.event.x;
		var rect = d3.select(this);
	    rect.attr('width',mouseX-rect.attr("x"))
			.attr("opacity",0.3);
	  })
	.on('dragend',function(){
	    //calculate where the start and end of the zoomed timeline will be
		var edge = parseInt(d3.select(this).attr('width')) + parseInt(d3.select(this).attr('x'));
		var start = x.invert(parseInt(d3.select(this).attr('x')));
		var end = x.invert(edge);
		
		//zoom the timeline
		x.domain([start,end])
		 .range([0, chartWidth*0.95]);
		
		var timeDiff = end.getTime() - start.getTime();
		timeDiff = timeDiff/1000;
		
		
		//TODO: figure out the ticks/subdivide that looks nice for different zoom levels
		if(timeDiff <= (1 * 60 * 60)){
			xAxis.ticks(d3.time.minutes, 15)
				.tickSubdivide(3).tickSize(-30,-15,-30);
		}
		
		
		else if(timeDiff <= (24 * 60 * 60)){
		    xAxis.ticks(d3.time.hours, 1)
			    .tickSubdivide(1).tickSize(-30,-15,-30);
		}
		
		else if(timeDiff <= (48 * 60 * 60)){
		    xAxis.ticks(d3.time.hours, 6)
			    .tickSubdivide(3).tickSize(-30,-15,-30);
		}
		//update the scale
		scaleGroup.call(xAxis);
	
	    //select all the images that fall within the new range
		var remainingImages = imageGroup.selectAll("image").filter(function(d) {
           return (d.takenDate.getTime() >= start.getTime()) && (d.takenDate.getTime() <= end.getTime() );
         });
		//select all the images that are out side the range
		var outofRangeImages = imageGroup.selectAll("image").filter(function(d) {
           return (d.takenDate.getTime() < start.getTime()) || (d.takenDate.getTime() > end.getTime() );
         });

		//fade out the non-selected images
		outofRangeImages.transition(500).attr("opacity",0);
		//first slide the images up
        remainingImages.transition(500).attr("y",(chartHeight*0.95)-40)
			//next slide the images over to their new x position
			.each("end",function(d,i){
				d3.select(this).transition(500).attr("x",x(d.takenDate))
					//finally slide them back dowm
					.each("end",function(d,i){
						d3.select(this).transition(500).attr("y",(chartHeight*0.95)-30);
					});
			});
		
		//resize and reposition the selector
		d3.select(this)
			.attr('width',selectorWidth)
			.attr("opacity",0.75)
			.attr("x",x(parseDate(timeList[i]))-10);
	});
	

	//add the selector to the timeline
	rectGroup.append("rect")
		.attr("x",x(parseDate(timeList[i]))-10)
		.attr("y", (chartHeight*0.95)-selectorHeight)
		.attr("height", selectorHeight)
		.attr("width", selectorWidth)
		.attr("fill","orange")
		.attr("opacity",0.75)
		.call(dragBox);
		
	var minTakenTime = minTime.getTime()/1000;
		
	//make multiple calls so that we can get an evenish distribution for all days
	//going to retrieve images for each day-range section
	for(var dayCount = 0;dayCount<5; dayCount++){
	
	var maxTakenTime = minTakenTime + (1*24*60*60);
	
	var url = "http://api.flickr.com/services/rest/?method=flickr.photos.search"
				+"&api_key=446bef3217f1f778800aeaf8f2ff17cc&format=json"
				+"&privacy_filter=1&tags=hurricane sandy,frankenstorm,superstorm,sandy"
				+"&min_taken_date="+minTakenTime
				+"&max_taken_date="+maxTakenTime
				;

	//after we built the url, update the maxTaken for the next iteration
     minTakenTime = maxTakenTime;
	//get a list of images that contain the tag(s) and are within the specified
	//time range
	$.getJSON(url + "&jsoncallback=?", null, function(response) {
	        var photos = shuffle(response.photos.photo);
	        var endIndex = (photos.length >= 20) ? 20 : photos.length; 
			for(var i=0;i<endIndex;i++){
				var photo = photos[i];
				var thumbUrl = "http://farm"+photo.farm+".staticflickr.com/"+photo.server+"/"+photo.id+"_"+photo.secret+"_s.jpg";
				var biggerUrl = "http://farm"+photo.farm+".staticflickr.com/"+photo.server+"/"+photo.id+"_"+photo.secret+"_c.jpg";
				//need another call to get the photo taken time
				var info_url = "http://api.flickr.com/services/rest/?method=flickr.photos.getInfo"
							+"&api_key=446bef3217f1f778800aeaf8f2ff17cc&format=json"
							+"&photo_id="+photo.id;
				
			  //mmmmm closures in a for loop, I love you javascript ;)
			  //need to wrap the second call in a function, so that
			  //the variables that I want to pass to the success closure are
			  //in the right scope	
			   var wrapper = function(i,thumbUrl,biggerUrl,photo){		
				   $.getJSON(info_url + "&jsoncallback=?", null, function(response) {
					   var takenDate = response.photo.dates.taken;
					   var timelinePhoto = {};
					   timelinePhoto.thumbUrl = thumbUrl;
					   timelinePhoto.biggerUrl = biggerUrl;
					   timelinePhoto.takenDate = Date.parse(takenDate);
					   timelinePhotos.push(timelinePhoto);
					   
					   if(timelinePhotos.length == 100){
						    //all the photos were added, so sort them by
						    //taken time to get a nice falling into place animation 
							timelinePhotos.sort(function(a, b) {
							   return (a.takenDate.getTime() < 
								b.takenDate.getTime()) ? -1 : (a.takenDate.getTime() > b.takenDate.getTime()) ? 1 : 0;
							})
							//add the photos to the timeline
						    addPhotos(timelinePhotos,imageGroup,x);
					}
					   
					   
				   });
			  };
			
			   wrapper(i,thumbUrl,biggerUrl,photo);
			}
	
});
	
}
	$(document).keydown(function(e){
	 //move the position of the storm and the selector back   
	 if (e.keyCode == 37) { 
	       if(i -1 >= 0){
			
			i--;
			updateHurricanePosition(timeList[i],pointsGroup,radiiGroup,"back");
				var rect = rectGroup.select("rect");
				rect.transition().duration(400).attr("x",x(parseDate(timeList[i]))-(selectorWidth/2));
			}
	       return false;
	    }
		//move the position of the storm and the selector forward
		if (e.keyCode == 39) { 
	      if(i +1 < timeList.length){
			i++;
			updateHurricanePosition(timeList[i],pointsGroup,radiiGroup,"forward");
			var rect = rectGroup.select("rect");
			rect.transition().duration(400).attr("x",x(parseDate(timeList[i]))-(selectorWidth/2));
			
			}
	       return false;
	    }
		//unzoom
		if (e.keyCode == 38) { 
			//get the current time of the selector
			var rect = rectGroup.select("rect");
			var time = x.invert(parseInt(rect.attr('x')));
	       	x.domain([minTime,maxTime])
	       	 .range([0, chartWidth*0.95]);
	       	xAxis.ticks(d3.time.days, 1)
	       	xAxis.tickSubdivide(3).tickSize(-30,-15,-30);
	       	scaleGroup.call(xAxis);
	        rect.attr("x",x(time));
	        imageGroup.selectAll("image").remove();
			addPhotos(timelinePhotos,imageGroup,x);
	       return false;
	    }
	
	});	
}

function updateHurricanePosition(time,pointsGroup,radiiGroup,direction){
		var points = pointsGroup.selectAll("path")
	         .filter(function(d) {
	           return time == d.properties.DTG;
	         });

		var radii = radiiGroup.selectAll("path")
			.filter(function(d){
				return time == parseInt(d.properties.SYNOPTIME);
			});

	    if(direction=="forward"){
		    points.transition().duration(1000).style("opacity",1);
		   radii.transition().duration(1000).style("opacity",0.1);
	}
	    else if(direction == "back"){
		    points.transition().duration(1000).style("opacity",0);
			radii.transition().duration(1000).style("opacity",0);
	}
	    
		///going to cheat, I know that the date will be Oct 2012
	    var s = time.toString();
	    var day = s.substring(6,8);
		var time = s.substring(8)+"00";
		
		var month = "Oct";
		var year = "2012";
		
	
		viewModel.year(year);
	    viewModel.day(day);
	    viewModel.month(month);
	    viewModel.timeOfDay(time);
	
}



function parseDate(date){
	
	var parse = d3.time.format("%Y-%m-%d %H:%M").parse;
	var format = d3.time.format("%Y-%m-%d %H:%M");
	
	var s = date.toString();
	//going to cheat, I know that the date will be Oct 2012
	//just need to get the day and time
	var day = s.substring(6,8);
	var time = s.substring(8)+":00";
	var date = "2012-10-"+day+" "+time;
	return parse(date);
}

//implementation of Fisher-Yates shuffle via: http://bost.ocks.org/mike/shuffle/
function shuffle(array) {
  var m = array.length, t, i;

  // While there remain elements to shuffle…
  while (m) {

    // Pick a remaining element…
    i = Math.floor(Math.random() * m--);

    // And swap it with the current element.
    t = array[m];
    array[m] = array[i];
    array[i] = t;
  }

  return array;
}

function addPhotos(timelinePhotos,imageGroup,x){
	var width = 30;
	var height = 30;
	
	
	imageGroup.selectAll("image")
	    .data(timelinePhotos)
		.enter().append("image")
		.attr("x",function(d){return x(d.takenDate)-(width/2);})
		.attr("y",(chartHeight*0.95)-40)
		.attr("width",width)
		.attr("height",height)
		.attr("xlink:href",function(d){return d.thumbUrl;})
		.attr("opacity",0)
		.on("click",function(d){
			$("#lightboxImg").attr("src", d.biggerUrl);
			$('#picLightbox').lightbox(); 
		})
		.transition().duration(1000).attr("opacity",0.75)
		.each("end",function(d,i){
			d3.select(this).transition()
			.delay(function(d1, index) {return i* 10; })
			.duration(500).attr("y",(chartHeight*0.95)-30);
		});
		
}



