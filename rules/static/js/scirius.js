function prepare_rule_details() {
    $(".msg").click(function( event ) {
        if ($(this).find(".detail").length) {
            $(this).find(".detail").slideUp(
                function() {
                    $(this).remove();
                }
            );
        } else {
            sid = $( this ).parent().find("a").html();
            $.ajax(
                {
                        type:"GET",
                        url:"/rules/rule/"+sid,
                        success: function(data) {
                            mylink = $('a').filter(function(index) { return $(this).text() == data.sid; });
                            mytd = mylink.parent().parent().find(".msg");
                            mytd.append("<div class='detail'>" + data.highlight_content + "</div>");
                            mytd.find(".detail").slideDown();
                        },
                }
            );
        }
    });
}

$( 'document' ).ready(function() {
        prepare_rule_details();
});


function load_rules(from_date, hosts, filter) {
    var tgturl = "/rules/es?query=rules&host=" + hosts.join() + "&from_date=" + from_date;
    if (filter != null) {
       tgturl = tgturl + "&filter=" + filter;
    }
    $.ajax({
       url: tgturl,
          success: function(data) {
             $('#rules_table').empty();
             $('#rules_table').append(data);
             prepare_rule_details();
          },
	  error: function(data) {
             $('#rules_table').text("Unable to get data.");
             $("#error").text("Unable to get data from Elasticsearch");
             $("#error").parent().toggle();
	  }
    });
}


function draw_timeline(from_date, hosts, filter) {

        esurl = "/rules/es?query=timeline&from_date=" + from_date + "&hosts=" + hosts.join()
        if (filter) {
            esurl = esurl + "&filter=" + filter;
        }
        $.ajax(
                        {
                        type:"GET",
                        url:esurl,
                        success: function(data) {
			    $("#timeline span").hide();
                            nv.addGraph(function() {
		            /* starting from 4 hosts multibar is unreadable */
                            if (hosts.length > 3) {
                              var chart = nv.models.lineChart()
                                            .margin({left: 100})  //Adjust chart margins to give the x-axis some breathing room.
                                            .useInteractiveGuideline(true)  //We want nice looking tooltips and a guideline!
                                            .transitionDuration(350)  //how fast do you want the lines to transition?
                                            .showLegend(true)       //Show the legend, allowing users to turn on/off line series.
                                            .showYAxis(true)        //Show the y-axis
                                            .showXAxis(true)        //Show the x-axis
                              ;
                              } else {
                            multigraph = false;
                            if (hosts.length > 1) {
                                    multigraph = true;
                            }
                            var chart = nv.models.multiBarChart()
                                .transitionDuration(350)
                                .reduceXTicks(true)   //If 'false', every single x-axis tick label will be rendered.
                                .rotateLabels(0)      //Angle to rotate x-axis labels.
                                .showControls(multigraph)   //Allow user to switch between 'Grouped' and 'Stacked' mode.
                                .groupSpacing(0.1)    //Distance between each group of bars.
                                ;
                               }
                                chart.xAxis.tickFormat(function(d) {
                                    return d3.time.format('%m/%d %H:%M')(new Date(d))
                                });

                                chart.yAxis
                                .tickFormat(d3.format(',.1f'));

                                var end_interval = new Date().getTime();
                                var sdata = []
                                for (hi = 0; hi < hosts.length; hi++) {
                                        gdata = []
                                        var starti = 0;
                                        var iter = 0;
                                        entries = data[hosts[hi]]['entries']
                                        var interval = parseInt(data['interval']);
                                        for (inter = parseInt(data['from_date']); inter < end_interval; inter = inter + interval) {
                                            found = false;
                                            for (i = starti; i < entries.length; i++) {
                                                if (Math.abs(entries[i]["time"] - inter) <= interval/2) {
                                                    gdata.push({x: inter, y: entries[i]["count"]});
                                                    found = true;
                                                    starti = i + 1;
                                                    break;
                                                }
                                            }
                                            if (found == false) {
                                                    gdata.push({x: inter, y: 0});
                                            }
                                        }
                                        sdata.push(
                                        {
                                            values: gdata,
                                            key: hosts[hi],
                                            //color: '#AD9C9B',  //color - optional: choose your own line color.
                                            //area: true
                                        }
                                        );
                                }
                                d3.select('#timeline svg')
                                        .datum(sdata)
                                        .call(chart);

                                nv.utils.windowResize(function() { chart.update() });
                                return chart;
                        });
                },
        });
}

function build_path(d) {
  tooltip = d.msg ? d.msg : d.key ? d.key : "Unknown";
  if (tooltip == "categories") {
      return "";
  }
    tooltip = "<div class='label label-default'>" + tooltip + "</div>";
    if (d.parent && d.parent.key != "categories") {
      tip = d.parent.key ? d.parent.key : "Unknown";
      tooltip = "<div class='label label-default'>"+ tip + "</div>\n" + tooltip;
    }
  return tooltip;
}

function draw_sunburst(from_date, hosts, filter, callback) {
        esurl = "/rules/es?query=rules_per_category&from_date=" + from_date + "&hosts=" + hosts.join()
        if (filter) {
            esurl = esurl + "&filter=" + filter;
        }
        $.ajax(
         {
         type:"GET",
         url:esurl,
         success: function(data) {
         if (data == null) {
              $("#circles").append("No data to build the graph");
              return;
         }
var width = 300,
    height = 300,
    radius = Math.min(width, height) / 2;

var x = d3.scale.linear()
    .range([0, 2 * Math.PI]);

var y = d3.scale.sqrt()
    .range([0, radius]);

var color = d3.scale.category20b();

var svg = d3.select("#circles").append("svg")
    .attr("width", width)
    .attr("height", height)
  .append("g")
    .attr("transform", "translate(" + width / 2 + "," + (height / 2 + 10) + ")");

var partition = d3.layout.partition()
    .sort(null)
    .value(function(d) { return d.doc_count; })
    .children(function(d) { return d.children; })

var arc = d3.svg.arc()
    .startAngle(function(d) { return Math.max(0, Math.min(2 * Math.PI, x(d.x))); })
    .endAngle(function(d) { return Math.max(0, Math.min(2 * Math.PI, x(d.x + d.dx))); })
    .innerRadius(function(d) { return Math.max(0, y(d.y)); })
    .outerRadius(function(d) { return Math.max(0, y(d.y + d.dy)); });

// Keep track of the node that is currently being displayed as the root.
var node;
  root = data;
  node = root;
  var path = svg.datum(root).selectAll("path")
      .data(partition.nodes)
    .enter().append("path")
      .attr("d", arc)
      //.style("fill", function(d) { return color(d.value); })
      .style("fill", function(d) { return color(d.key); })
      .on("click", click)
      .each(stash);



  $('path').mouseover(function(){
      var d = this.__data__;
      tooltip = build_path(d);
      $( "#circles").append("<div id='circles_tooltip'>" + tooltip + "</div>");
  });
  $('path').mouseout(function(){
      var d = this.__data__;
      $( "#circles_tooltip").remove();
  });

  d3.selectAll("input").on("change", function change() {
    var value = this.value === "count"
        ? function() { return 1; }
        : function(d) { return d.size; };

    path
        .data(partition.value(value).nodes)
      .transition()
        .duration(1000)
        .attrTween("d", arcTweenData);
  });

  function click(d) {
    node = d;
    if (d.children == undefined) {
         window.open("/rules/rule/pk/" + d.key,"_self");
    }
    $("#filter").empty();
    if (tooltip.length) {
        $("#filter").append("Filter: " + tooltip);
    }
    if (d.key == "categories") {
        draw_timeline(from_date, hosts, null);
        load_rules(from_date, hosts, null);
    } else {
        draw_timeline(from_date, hosts, 'alert.category.raw:"'+d.key+'"');
        load_rules(from_date, hosts, 'alert.category.raw:"'+d.key+'"');
    }
    path.transition()
      .duration(1000)
      .attrTween("d", arcTweenZoom(d));
  }

d3.select(self.frameElement).style("height", height + "px");

// Setup for switching data: stash the old values for transition.
function stash(d) {
  d.x0 = d.x;
  d.dx0 = d.dx;
}

// When switching data: interpolate the arcs in data space.
function arcTweenData(a, i) {
  var oi = d3.interpolate({x: a.x0, dx: a.dx0}, a);
  function tween(t) {
    var b = oi(t);
    a.x0 = b.x;
    a.dx0 = b.dx;
    return arc(b);
  }
  if (i == 0) {
   // If we are on the first arc, adjust the x domain to match the root node
   // at the current zoom level. (We only need to do this once.)
    var xd = d3.interpolate(x.domain(), [node.x, node.x + node.dx]);
    return function(t) {
      x.domain(xd(t));
      return tween(t);
    };
  } else {
    return tween;
  }
}

// When zooming: interpolate the scales.
function arcTweenZoom(d) {
  var xd = d3.interpolate(x.domain(), [d.x, d.x + d.dx]),
      yd = d3.interpolate(y.domain(), [d.y, 1]),
      yr = d3.interpolate(y.range(), [d.y ? 20 : 0, radius]);
  return function(d, i) {
    return i
        ? function(t) { return arc(d); }
        : function(t) { x.domain(xd(t)); y.domain(yd(t)).range(yr(t)); return arc(d); };
  };
}

     callback();
        },
        });
}

function draw_circle(from_date, hosts, filter, callback) {
        esurl = "/rules/es?query=rules_per_category&from_date=" + from_date + "&hosts=" + hosts.join()
        if (filter) {
            esurl = esurl + "&filter=" + filter;
        }
        $.ajax(
         {
         type:"GET",
         url:esurl,
         success: function(data) {
             var margin = 20,
                 diameter = 300;
             
             var color = d3.scale.linear()
                 .domain([-1, 2])
                 .range(["rgb(179,191,202)", "rgb(74,143,202)"])
                 .interpolate(d3.interpolateHcl);

             var pack = d3.layout.pack()
                 .padding(2)
                 .size([diameter - margin, diameter - margin])
                 .value(function(d) { return d.doc_count; })
                 .children(function(d) { return d.children; })
             
             var svg = d3.select("#circles").append("svg")
                 .attr("width", diameter)
                 .attr("height", diameter)
               .append("g")
                 .attr("transform", "translate(" + diameter / 2 + "," + diameter / 2 + ")");
            
             root = data
               var focus = root,
                   nodes = pack.nodes(root),
                   view;
             
               var circle = svg.selectAll("circle")
                   .data(nodes)
                   .enter().append("circle")
                   .attr("class", function(d) { return d.parent ? d.children ? "node" : "node node--leaf" : "node node--root"; })
                   .style("fill", function(d) { return d.children ? color(d.depth) : null; })
                   .on("click", function(d) { if (focus !== d) zoom(d), d3.event.stopPropagation(); });
            
               $('circle').tipsy({ 
                 gravity: 'w', 
                 html: true, 
                 fade: 'true',
                 title: function() {
                   var d = this.__data__;
               if (d.msg) {
                       return d.msg;
               }
                   return d.key ? d.key : "Unknown"; 
                 }
               });

               var node = svg.selectAll("circle,text");
             
               d3.select("circle")
                   .style("background", color(-1))
                   .on("click", function() { zoom(root); });
             
               zoomTo([root.x, root.y, root.r * 2 + margin]);
             
               function zoom(d) {
                 var focus0 = focus; focus = d;
             
                 if (d.children == undefined) {
                     window.open("/rules/rule/pk/" + d.key,"_self");
                 }
                 $("#filter").empty();
                 tooltip = build_path(d);
                 if (tooltip.length) {
                     $("#filter").append("Filter: " + tooltip);
                 }
                 if (d.key == "categories") {
                     draw_timeline(from_date, hosts, null);
                     load_rules(from_date, hosts, null);
                 } else {
                     draw_timeline(from_date, hosts, 'alert.category.raw:"'+d.key+'"');
                     load_rules(from_date, hosts, 'alert.category.raw:"'+d.key+'"');
                 }
                 var transition = d3.transition()
                     .duration(d3.event.altKey ? 7500 : 750)
                     .tween("zoom", function(d) {
                       var i = d3.interpolateZoom(view, [focus.x, focus.y, focus.r * 2 + margin]);
                       return function(t) { zoomTo(i(t)); };
                     });
               }
             
               function zoomTo(v) {
                 var k = diameter / v[2]; view = v;
                 node.attr("transform", function(d) { return "translate(" + (d.x - v[0]) * k + "," + (d.y - v[1]) * k + ")"; });
                 circle.attr("r", function(d) { return d.r * k; });
               }
             
             d3.select(self.frameElement).style("height", diameter + "px");

             callback();
          },
        });
}

/* function draw_influxdb_timeline(from_date, hosts, filter) { */
function draw_influxdb_timeline(time_range) {
        esurl = "/rules/influxdb?time_range=" + time_range
        $.ajax(
                        {
                        type:"GET",
                        url:esurl,
                        success: function(data) {
			                $("#timeline span").hide();
                            nv.addGraph(function() {
                              var chart = nv.models.stackedAreaChart()
                                            .margin({left: 100})  //Adjust chart margins to give the x-axis some breathing room.
                                            .useInteractiveGuideline(true)  //We want nice looking tooltips and a guideline!
                                            .transitionDuration(350)  //how fast do you want the lines to transition?
                                            .showLegend(true)       //Show the legend, allowing users to turn on/off line series.
                                            .showYAxis(true)        //Show the y-axis
                                            .showXAxis(true)        //Show the x-axis
                              ;
                                chart.xAxis.tickFormat(function(d) {
                                    return d3.time.format('%m/%d %H:%M')(new Date(d * 1000))
                                });

                                chart.yAxis
                                .tickFormat(d3.format(',.2f'));

                                var sdata = []
                                for (hi = 0; hi < data.length; hi++) {
                                        entries = data[hi]['points'];
                                        gdata = [];
                                        for (he = 0; he < entries.length; he++) {
                                            gdata.push({x: entries[he][0], y: entries[he][1]});
                                        }
                                        sdata.push(
                                        {
                                            values: gdata,
                                            key: data[hi]["name"].split(".")[1].toUpperCase(),
                                        }
                                        );
                                }
                                d3.select('#timeline svg')
                                        .datum(sdata)
                                        .call(chart);

                                nv.utils.windowResize(function() { chart.update() });
                                return chart;
                        });
                },
        });
}

