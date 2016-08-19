//dependency:
//d3.js version 3.1.6
//jquery.js version 2.1.1

_d3_linechart_dict = {};
$.fn.d3_linechart = function(){
    
    d3_linechart = function() 
    {
        //data是唯一的在渲染前强制要求绑定好的属性
        var data = undefined;

        //绑定时自动加上的属性
        var parent = undefined;//用jquery选中的parent
        var parent_id = undefined;

        //在chart中不会修改的渲染外形变量
        var width = 640,  
            height = 480, 
            xlabel = "X Axis Label",
            ylabel = "Y Axis Label" ,
            draw_xgrid = false,
            draw_ygrid = false,
            draw_datalabel = true,
            margin = {top: 20, right: 20, bottom: 20, left: 20}
            yTickNum = undefined,
            draw_xAxis = true,
            draw_yAxis = true,
            transition_duration = 500,
            color_scale = function(i){return "#80B0FF";},
            x_scale_type = "linear";

        //在chart中不会修改的其他变量
        var linechart_id = undefined;

        //在chart中会修改的变量
        var x = {   data_min:undefined,
                    data_max:undefined,
                    mousemove_value:undefined,
                    display_min:undefined,
                    display_max:undefined,},
            y = {   data_min:undefined,
                    data_max:undefined,
                    display_min:undefined,
                    display_max:undefined,},
            g = undefined;

        //在chart中会修改的函数，且不允许赋值，只允许访问
        var zoom_to_xrange = undefined;
        var draw_tick = undefined;
        var render = function(){
            if (d3.select(_get_core_element(parent)).select("svg")[0][0]===null)
            {
                d3.select(_get_core_element(parent)).append("svg")
                    .attr("width",width)
                    .attr("height",height)   
            }
            d3.select(_get_core_element(parent)).select("svg")
                .datum(data)
                .call(chart);
        };

        //在chart中不会修改的函数，允许修改
        var mousemove = function(){};

        function _get_core_element(jquery_element){
            return jquery_element[0];
        }
        
        function chart(selection) 
        {
            if (selection.length > 1)
                console.warn("selection length > 1",selection);

            selection.each(function(datasets) 
            {
                var innerwidth = width - margin.left - margin.right;
                var innerheight = height - margin.top - margin.bottom;
                
                //统计x轴的scale取多少
                x.data_min = d3.min(datasets, function(d) { return d.data[0].x; });
                x.data_max = d3.max(datasets, function(d) { return d.data[d.data.length-1].x; });
                x.display_min = x.data_min;
                x.display_max = x.data_max;
                
                if (x_scale_type == "linear")
                    var x_scale = d3.scale.linear()
                else if (x_scale_type == "time")
                    var x_scale = d3.time.scale()
                x_scale.range([0, innerwidth])
                    .domain([x.data_min, x.data_max]);    

                //统计y轴的scale取多少
                y.data_min = d3.min(datasets, function(d) { 
                    var dataset = d.data;
                    return d3.min(dataset,function(d){return d.y})
                });
                y.data_max = d3.max(datasets, function(d) { 
                    var dataset = d.data;
                    return d3.max(dataset,function(d){return d.y})
                });
                y.display_min = y.data_min;
                y.display_max = y.data_max;
                var y_scale = d3.scale.linear()
                    .range([innerheight, 0])
                    .domain([y.data_min, y.data_max]);

                var x_axis = d3.svg.axis()
                    .scale(x_scale)
                    .orient("bottom");

                var y_axis = d3.svg.axis()
                    .scale(y_scale)
                    .orient("left")
                    .tickFormat(d3.format(""))

                var tickValues = [];
                if (typeof(yTickNum)!="undefined")//如果需要约束y轴的tick的数量
                {
                    var yvalue_min = y_scale.domain()[0];
                    var yvalue_max = y_scale.domain()[1];
                    if (typeof(yvalue_min)=="number" && !isNaN(yvalue_min) && typeof(yvalue_max)=="number" && !isNaN(yvalue_max))
                    {
                        var step = (yvalue_max-yvalue_min)/(yTickNum-1);
                        for (var i=0;i<yTickNum;++i)
                        {
                            tickValues.push(yvalue_min+i*step);
                        }
                        y_axis.tickValues( tickValues );
                    }
                }

                //画线的函数
                var draw_line = d3.svg.line()
                    //.interpolate("basis")
                    .interpolate("linear")//不使用linear时，画hover的点不一定能保证和线对齐
                    .x(function(d) { 
                        if (typeof(d[0])!="undefined" && typeof(d[1])!="undefined")
                            return x_scale(d[0]); 
                        return 0;
                    })
                    .y(function(d) { 
                        if (typeof(d[0])!="undefined" && typeof(d[1])!="undefined")
                            return y_scale(d[1]); 
                        return 0;
                    });

                var svg = d3.select(this)
                        .attr("id","svg_"+parent.attr("id"))
                        .attr("width", width)
                        .attr("height", height)
                g = svg.append("g")
                        .attr("transform", "translate(" + margin.left + "," + margin.top + ")")
                        .on("mousemove",function(){
                            var corrected_offsetX = d3.event.layerX - margin.left;
                            var value_x = x_scale.invert(corrected_offsetX);
                            x.mousemove_value = value_x;
                            for (var j=0;j<datasets.length;++j)
                            {
                                var search_result = binary_search(value_x,datasets[j].data,"x");
                                var search_index = search_result.index;
                                var search_x = datasets[j].data[search_index].x;
                                var search_y = datasets[j].data[search_index].y;

                                draw_mouseoverpoint(search_x,search_y,"mouseover_point_line_"+j)
                                draw_mouseovertip(search_x,search_y,"mouseover_tip_"+j)
                            }
                            if (typeof(mousemove)!="undefined")
                            {
                                mousemove();
                            }
                        })
                        .on("mouseout",function(){
                            x.mousemove_value = undefined;
                            remove_points("mouseoverpoint")
                            remove_mouseovertip()
                        })
                
                if (draw_xgrid)//如果需要画x轴向上的grid
                {
                    var x_grid = d3.svg.axis()
                        .scale(x_scale)
                        .orient("top")
                        .tickSize(innerheight)
                        .tickFormat("");

                    g.append("g")
                        .attr("class", "x linechart_grid")
                        .attr("transform", "translate(0," + innerheight + ")")
                        .call(x_grid);
                }

                if (draw_ygrid)//如果需要画y轴向右的grid
                {
                    var y_grid = d3.svg.axis()
                        .scale(y_scale)
                        .orient("right")
                        .tickSize(innerwidth)
                        .tickFormat("")

                    if (typeof(yTickNum)!="undefined")//如果需要约束y轴的tick的数量
                    {
                        y_grid.tickValues(tickValues);
                    }   

                    g.append("g")
                        .attr("class", "y linechart_grid")
                        .call(y_grid);
                }
                
                if (draw_xAxis)//如果需要画x轴
                {
                    g.append("g")
                            .attr("class", "x linechart_axis")
                            .attr("transform", "translate(0," + innerheight + ")") 
                            .call(x_axis)
                        .append("text")
                            .attr("class","linechart_axis_text")
                            .attr("dy", "-.71em")
                            .attr("x", innerwidth)
                            .text(xlabel);
                }

                if (draw_yAxis)//如果需要画y轴
                {
                    g.append("g")
                            .attr("class", "y linechart_axis")
                            .call(y_axis)
                        .append("text")
                            .attr("class","linechart_axis_text")
                            .attr("transform", "rotate(-90)")
                            .attr("y", 6)
                            .attr("dy", "0.71em")
                            .text(ylabel);
                }
                
                //画线
                var data_lines = g.selectAll(".d3_linechart_line")
                    .data(datasets.map(function(d) {
                        var zipped_array = [];
                        for (var j=0;j<d.data.length;++j)
                        {
                            zipped_array.push([d.data[j].x,d.data[j].y])
                        }
                        return zipped_array;
                    }))
                    .enter().append("g")//每条线包在一个g里面
                    .attr("class", "d3_linechart_line")
                data_lines.append("path")
                    .attr("class", "line")
                    .attr("d", function(d) { return draw_line(d); })
                    .attr("stroke", function(_, i) {return color_scale(i);});

                //画标记好颜色的特殊点
                var colored_point_line_storage =[];
                for (var i=0;i<datasets.length;++i)
                {
                    var cur_dataset = datasets[i].data;

                    var cur_line_storage = [];
                    for (var j=0;j<cur_dataset.length;++j)
                    {
                        var cur_item = cur_dataset[j];
                        if (typeof(cur_item.color)=="undefined")
                            continue;

                        var cur_color = cur_item.color;
                        var length = 1;
                        var cur_seg_storage = [j];
                        for (var k = j+1;k<cur_dataset.length;++k)
                        {
                            if (cur_dataset[k].color == cur_color)
                            {
                                length = length +1;
                                cur_seg_storage.push(k);
                            }
                            else
                                break;
                        }

                        cur_line_storage.push(cur_seg_storage)
                        j = j + (length-1);
                    }
                    if (cur_line_storage.length != 0)
                    {
                        colored_point_line_storage.push(cur_line_storage);
                    }
                }
                data_lines.each(function(d,i){
                    var data = datasets[i].data;
                    var colored_storage = colored_point_line_storage[i];
                    for (var j=0;j<colored_storage.length;++j)
                    {
                        var cur_seg = colored_storage[j];
                        var start_index = cur_seg[0];
                        var color = data[start_index].color;
                        var length = cur_seg.length;
                        if (length == 1)
                        {
                            d3.select(this).append("circle")
                                .attr("class", "colored_point")
                                .data([{x:data[start_index].x,y:data[start_index].y}])
                                .attr("cx",function(d){ return x_scale(d.x) })
                                .attr("cy",function(d){ return y_scale(d.y) })
                                .attr("r",3)
                                .attr("fill",color)
                        }
                        else
                        {
                            var line_data = [];
                            for (var k = 0;k < length;++k)
                            {
                                line_data.push( [ data[start_index+k].x , data[start_index+k].y ] )
                            }

                            d3.select(this).append("path")
                                .attr("class", "colored_line")
                                .data([{line_data:line_data}])
                                .attr("d", function(d){ return draw_line(d.line_data)})
                                .attr("fill","none")
                                .attr("stroke", color);
                        }
                    }
                })
                
                if (draw_datalabel)//如果需要画线末尾的label
                {
                    data_lines.append("text")
                        .attr("class","linechart_label_text")
                        .datum(function(d, i) { return {name: datasets[i].label, final: d[d.length-1]}; }) 
                        .attr("transform", function(d) { return ( "translate(" + x_scale(d.final[0]) + "," + y_scale(d.final[1]) + ")" ) ; })
                        .attr("x", 3)
                        .attr("dy", ".35em")
                        .attr("fill", function(_, i) { return color_scale(i); })
                        .text(function(d) { return d.name; });
                }

                var brush = d3.svg.brush()
                    .x(x_scale)
                    .on("brushstart", brushstart)
                    .on("brush", brushmove)
                    .on("brushend", brushend);
                g.append("g")
                    .attr("class", "x brush")
                    .call(brush)
                    .selectAll("rect")//在call返回的语境，即g的语境下，selectAll
                    .attr("height", innerheight);

                zoom_to_xrange = function zoompan_x(extent,is_zoom=true,force_scale=true)
                {
                    if ( (extent[0]==x.data_min) && (extent[1]==x.data_max) )//zoom回初始状态后删掉zoom按钮
                    {
                        d3.select(".linechart_reset_zoom"+"#linechart_reset_zoom_"+parent_id).remove()
                    }

                    hide_zoom_len()//不管任何情况，只要zoom或pan到一个范围后，都需要把len删掉

                    if (! force_scale)//force_scale时，即使没有brush，或者即使brush是空的，也要scale
                    {
                        if (brush.empty())
                            return;
                    }
                    x_scale.domain(extent);//zoom以后调整x轴scale的范围
                    
                    x.display_min = extent[0];
                    x.display_max = extent[1];

                    if (is_zoom)
                    {
                        g.selectAll(".d3_linechart_line").selectAll(".line")
                            .transition()
                            .duration(transition_duration)//duration结束时换上新的折线
                            .attr("d", function(d) { return draw_line(d); })

                        g.select(".x.linechart_axis")
                            .transition()
                            .duration(transition_duration)//duration结束时换上新的x轴
                            .call(x_axis);

                        if (draw_xgrid)
                        {
                            g.select(".x.linechart_grid")
                                .transition()
                                .duration(transition_duration)
                                .call(x_grid);
                        }

                        g.selectAll(".label_tick")
                            .transition()
                            .duration(transition_duration)
                            .attr("d",function(d,i){
                                var display_x = x_scale(d);
                                return "M"+display_x+","+0 + "L"+display_x+ ","+innerheight;
                            })

                        g.selectAll(".mouseoverpoint")
                            .transition()
                            .duration(transition_duration)
                            .attr("cx",function(d,i){ return x_scale(d.x_value) })
                            .attr("cy",function(d,i){ return y_scale(d.y_value) })

                        data_lines.selectAll(".linechart_label_text")//line尾巴上的text label
                            .transition()
                            .duration(transition_duration)
                            .attr("transform", function(d) { return ( "translate(" + x_scale(d.final[0]) + "," + y_scale(d.final[1]) + ")" ) ; })
                    
                        data_lines.selectAll(".colored_point")
                            .transition()
                            .duration(transition_duration)
                            .attr("cx",function(d){ return x_scale(d.x) })
                            .attr("cy",function(d){ return y_scale(d.y) })
                        data_lines.selectAll(".colored_line")
                            .transition()
                            .duration(transition_duration)
                            .attr("d", function(d){ return draw_line(d.line_data)})
                    }
                    else
                    {
                        g.selectAll(".d3_linechart_line").selectAll(".line")
                            .attr("d", function(d) { return draw_line(d); })

                        g.select(".x.linechart_axis")
                            .call(x_axis);

                        if (draw_xgrid)
                        {
                            g.select(".x.linechart_grid")
                                .call(x_grid);
                        }

                        g.selectAll(".label_tick")
                            .attr("d",function(d,i){
                                var display_x = x_scale(d);
                                return "M"+display_x+","+0 + "L"+display_x+ ","+innerheight;
                            })

                        g.selectAll(".mouseoverpoint")
                            .attr("cx",function(d,i){ return x_scale(d.x_value) })
                            .attr("cy",function(d,i){ return y_scale(d.y_value) })    

                        data_lines.selectAll(".linechart_label_text")
                            .attr("transform", function(d) { return ( "translate(" + x_scale(d.final[0]) + "," + y_scale(d.final[1]) + ")" ) ; })
                        
                        data_lines.selectAll(".colored_point")
                            .attr("cx",function(d){ return x_scale(d.x) })
                            .attr("cy",function(d){ return y_scale(d.y) })
                        data_lines.selectAll(".colored_line")
                            .attr("d", function(d){ return draw_line(d.line_data)})
                    }

                    if ( (extent[0]!=x.data_min) || (extent[1]!=x.data_max) )//如果没有reset zoom，就在svg上画一个reset按钮
                    {
                        var top = parent.offset().top + margin.top;
                        var left = parent.offset().left + margin.left;
                        
                        if (d3.select(".linechart_reset_zoom"+"#linechart_reset_zoom_"+parent_id)[0][0]===null)//如果之前body没有加过reset按钮，才再画一个，否则不画
                        {
                            _draw_reset_buttom()
                            function _draw_reset_buttom()
                            {
                                d3.select("body")
                                    .append("div")
                                        .attr("id","linechart_reset_zoom_"+parent_id)
                                        .attr("class","linechart_reset_zoom")
                                        .style("left",left+"px")
                                        .style("top",top+"px")
                                        .on("click",function(d,i){
                                            zoompan_x([x.data_min,x.data_max],true,true)
                                        })
                                    .append("text")
                                        .text("reset")   
                            }
                        }
                    }
                }

                function hide_zoom_len()
                {
                    g.select(".x.brush").select(".extent").style("display","none")
                    g.select(".x.brush").select(".resize.e").select("rect").style("display","none")
                    g.select(".x.brush").select(".resize.w").select("rect").style("display","none")
                }

                function show_zoom_len()
                {
                    g.select(".x.brush").select(".extent").style("display","block")
                    g.select(".x.brush").select(".resize.e").select("rect").style("display","block")
                    g.select(".x.brush").select(".resize.w").select("rect").style("display","block")
                }

                var start_pageX = undefined;
                var end_pageX = undefined;

                function brushstart() 
                {
                    show_zoom_len()
                    if (d3.event.sourceEvent.shiftKey)
                        start_pageX = d3.event.sourceEvent.pageX;
                }
                
                function brushmove() 
                {
                    if (d3.event.sourceEvent.shiftKey)
                    {
                        end_pageX = d3.event.sourceEvent.pageX;
                        var start_x = x_scale.invert(start_pageX);
                        var end_x = x_scale.invert(end_pageX);

                        start_pageX = end_pageX;//更新start的锚定点
                        end_pageX = undefined;//重置end

                        if (typeof(start_x) != "undefined" && typeof(end_x) != "undefined")
                        {
                            var delta_x = end_x - start_x;
                            var display_min = x.display_min - delta_x;
                            var display_max = x.display_max - delta_x;

                            if (display_min < x.data_min)
                            {
                                var display_min = x.data_min;
                                var display_max = x.data_min + (x.display_max - x.display_min);
                            }
                            else if (display_max > x.data_max)
                            {
                                var display_max = x.data_max;
                                var display_min = x.data_max - (x.display_max - x.display_min);
                            }
                            zoom_to_xrange([display_min,display_max],false,false)
                        }
                    }
                }

                function brushend() 
                {
                    if (! d3.event.sourceEvent.shiftKey)
                    {
                        var extent = brush.extent();
                        if ( ! d3.event.sourceEvent.ctrlKey)//按住ctrl时不zoom in
                        {
                            zoom_to_xrange(extent,true,false)
                        }
                    }
                }    

                draw_tick = function(x_value,id,color="red")
                {
                    if (! (g.select("#"+id)[0][0]===null) )
                    {
                        g.select("#"+id).remove();
                    }
                    g.append("path")
                        .attr("class","label_tick")
                        .attr("pointer-events","none")
                        .attr("id",id)
                        .data([x_value])
                        .attr("d",function(d,i){
                            var display_x = x_scale(d);
                            return "M"+display_x+","+0 + "L"+display_x+ ","+innerheight;
                        })
                        .attr("stroke",color)
                        .attr("stroke-width",1)
                }

                function draw_mouseoverpoint(x_value,y_value,id,r=5)
                {
                    g.selectAll("#"+id).remove();//删掉老的point
                    g.append("circle")
                        .data([{x_value:x_value,y_value:y_value}])
                        .attr("id",id)
                        .attr("class","mouseoverpoint")
                        .attr("cx",function(d,i){ return x_scale(d.x_value) })
                        .attr("cy",function(d,i){ return y_scale(d.y_value) })
                        .attr("r",r)
                        .attr("fill","#80B0FF")
                        .attr("stroke-width",5)
                        .attr("stroke","#D0E0FF")
                }

                function remove_points(class_name)
                {
                    g.selectAll("."+class_name).remove();
                }

                function draw_mouseovertip(x_value,y_value,id)
                {
                    if (x_value < x_scale.domain()[0] || x_value > x_scale.domain()[1])//越界，此时需要专门删掉之前因为越界而不需要的tip
                    {
                        remove_mouseovertip();
                        return;
                    }

                    var anchor_top = parent.offset().top;
                    var anchor_left = parent.offset().left;

                    d3.select("body").selectAll("#"+id).remove();//删掉老的tip
                    var div = d3.select("body")
                            .append("div")
                                .data([{x_value:x_value,y_value:y_value}])
                                .attr("id",id)
                                .attr("class","mouseovertip")
                    div.html(function(d,i){
                        return   "x: "+d.x_value + " y: "+d.y_value;
                    })

                    var self_width = $("#"+id).width();
                    var self_height = $("#"+id).height();
                    var height_bias = 15;
                    var left_bias = 0;

                    div.style("left",function(d,i){
                            return x_scale(d.x_value) + anchor_left + margin.left - self_width/2 - left_bias + "px";
                        })
                        .style("top",function(d,i){
                            return y_scale(d.y_value) + anchor_top + margin.top - self_height - height_bias + "px";
                        })

                }

                function remove_mouseovertip()
                {
                    d3.select("body").selectAll(".mouseovertip").remove();
                }

                function binary_search(target_value,data_array,key_attr)//要求data_array从小到大sort过了
                {
                    var start_index = 0;
                    var end_index = data_array.length - 1;
                    while (start_index != end_index)
                    {
                        var middle_index = Math.floor((start_index + end_index)/2);
                        var middle_value = typeof(key_attr)=="undefined" ? data_array[middle_index] : data_array[middle_index][key_attr];

                        if (middle_value < target_value)
                        {
                            start_index = middle_index+1;
                        }
                        if (middle_value >= target_value)
                        {
                            end_index = middle_index;
                        }

                        if (start_index == end_index)
                        {
                            break;
                        }
                    }

                    var upper_bound_index = start_index;
                    var upper_bound_value = typeof(key_attr)=="undefined" ? data_array[upper_bound_index] : data_array[upper_bound_index][key_attr];
                    var lower_bound_index = (start_index-1) >=0 ? (start_index-1) : start_index;
                    var lower_bound_value = typeof(key_attr)=="undefined" ? data_array[lower_bound_index] : data_array[lower_bound_index][key_attr];

                    if (Math.abs(upper_bound_value - target_value) < Math.abs(lower_bound_value - target_value))
                    {
                        return {    index: upper_bound_index,
                                    value: upper_bound_value};
                    }
                    else
                    {
                        return {    index: lower_bound_index,
                                    value: lower_bound_value};
                    }
                }

            });
        }

        chart.mousemove = function(value){
            if (!arguments.length) return mousemove;
            if (typeof(value)!="function")
            {
                console.warn("invalid value for mousemove",value);
                return;
            }
            mousemove = value;
            return chart;
        };

        chart.draw_tick = function(){
            if (!arguments.length) return draw_tick;
            console.warn("cannot be customized: draw_tick")
        };

        chart.zoom_to_xrange = function(){
            if (!arguments.length) return zoom_to_xrange;
            console.warn("cannot be customized: zoom_to_xrange")
        };

        chart.render = function(){
            if (!arguments.length) return render;
            console.warn("cannot be customized: render")
        };

        chart.g = function(value){
            if (!arguments.length) return g;
            if (typeof(value)!="object")
            {
                console.warn("invalid value for g",value);
                return;
            }
            g = value;
            return chart;
        };

        chart.x_scale_type = function(value){
            if (!arguments.length) return x_scale_type;
            if (typeof(value)!="string")
            {
                console.warn("invalid value for x_scale_type",value);
                return;
            }
            x_scale_type = value;
            return chart;
        };

        chart.color_scale = function(value){
            if (!arguments.length) return color_scale;
            if (typeof(value)!="function")
            {
                console.warn("invalid value for color_scale",value);
                return;
            }
            color_scale = value;
            return chart;
        };

        chart.y = function(value){
            if (!arguments.length) return y;
            if (typeof(value)!="object")
            {
                console.warn("invalid value for y",value);
                return;
            }
            if (typeof(value.data_min)=="number")
                y.data_min = value.data_min;
            if (typeof(value.data_max)=="number")
                y.data_max = value.data_max;
            if (typeof(value.display_min)=="number")
                y.display_min = value.display_min;
            if (typeof(value.display_max)=="number")
                y.display_max = value.display_max;
            return chart;
        };

        chart.x = function(value){
            if (!arguments.length) return x;
            if (typeof(value)!="object")
            {
                console.warn("invalid value for x",value);
                return;
            }
            if (typeof(value.data_min)=="number")
                x.data_min = value.data_min;
            if (typeof(value.data_max)=="number")
                x.data_max = value.data_max;
            if (typeof(value.mousemove_value)!="undefined")
                console.warn("cannot be customized: x.mousemove_value");
            if (typeof(value.display_min)=="number")
                x.display_min = value.display_min;
            if (typeof(value.display_max)=="number")
                x.display_max = value.display_max;
            return chart;
        };

        chart.data = function(value){
            if (!arguments.length) return data;
            if (typeof(value)!="object")
            {
                console.warn("invalid value for data",value);
                return;
            }
            data = value;
            return chart;
        };

        chart.transition_duration = function(value){
            if (!arguments.length) return transition_duration;
            if (typeof(value)!="number")
            {
                console.warn("invalid value for transition_duration",value);
                return;
            }
            transition_duration = value;
            return chart;
        };

        chart.draw_yAxis = function(value){
            if (!arguments.length) return draw_yAxis;
            if (typeof(value)!="boolean")
            {
                console.warn("invalid value for draw_yAxis",value);
                return;
            }
            draw_yAxis = value;
            return chart;
        };

        chart.draw_xAxis = function(value){
            if (!arguments.length) return draw_xAxis;
            if (typeof(value)!="boolean")
            {
                console.warn("invalid value for draw_xAxis",value);
                return;
            }
            draw_xAxis = value;
            return chart;
        };

        chart.yTickNum = function(value) {
            if (!arguments.length) return yTickNum;
            if (typeof(value)!="number")
            {
                console.warn("invalid value for yTickNum",value);
                return;
            }
            yTickNum = value;
            return chart;
        };

        chart.margin = function(value) {
            if (!arguments.length) return margin;
            if (typeof(value)!="object")
            {
                console.warn("invalid value for margin",value);
                return;
            }
            if (typeof(value.top)=="number")
                margin.top = value.top;
            if (typeof(value.right)=="number")
                margin.right = value.right;
            if (typeof(value.bottom)=="number")
                margin.bottom = value.bottom;
            if (typeof(value.left)=="number")
                margin.left = value.left;
            return chart;
        };

        chart.draw_xgrid = function(value){
            if (!arguments.length) return draw_xgrid;
            if (typeof(value)!="boolean")
            {
                console.warn("invalid value for draw_xgrid",value);
                return;
            }
            draw_xgrid = value;
            return chart;
        };

        chart.draw_ygrid = function(value){
            if (!arguments.length) return draw_ygrid;
            if (typeof(value)!="boolean")
            {
                console.warn("invalid value for draw_ygrid",value);
                return;
            }
            draw_ygrid = value;
            return chart;
        };

        chart.draw_datalabel = function(value){
            if (!arguments.length) return draw_datalabel;
            if (typeof(value)!="boolean")
            {
                console.warn("invalid value for draw_datalabel",value);
                return;
            }
            draw_datalabel = value;
            return chart;
        };

        chart.width = function(value) {
            if (!arguments.length) return width;
            if (typeof(value)!="number")
            {
                console.warn("invalid value for width",value);
                return;
            }
            width = value;
            return chart;
        };

        chart.height = function(value) {
            if (!arguments.length) return height;
            if (typeof(value)!="number")
            {
                console.warn("invalid value for height",value);
                return;
            }
            height = value;
            return chart;
        };

        chart.xlabel = function(value) {
            if(!arguments.length) return xlabel;
            if (typeof(value)!="string")
            {
                console.warn("invalid value for xlabel",value);
                return;
            }
            xlabel = value ;
            return chart ;
        };

        chart.ylabel = function(value) {
            if(!arguments.length) return ylabel;
            if (typeof(value)!="string")
            {
                console.warn("invalid value for ylabel",value);
                return;
            }
            ylabel = value ;
            return chart ;
        };

        chart.linechart_id = function(value) {
            if(!arguments.length) return linechart_id;
            if (typeof(value)!="string")
            {
                console.warn("invalid value for linechart_id",value);
                return;
            }
            linechart_id = value ;
            return chart ;
        };

        chart.parent_id = function(value){
            if (!arguments.length) return parent_id;
            if (typeof(value)!="string")
            {
                console.warn("invalid value for parent_id",value);
                return;
            }
            parent_id = value;
            return chart;
        };

        chart.parent = function(value){
            if (!arguments.length) return parent;
            if (typeof(value)!="object")
            {
                console.warn("invalid value for parent",value);
                return;
            }
            parent = value;
            return chart;
        };

        return chart;
    }

    var this_id = this.attr("id");
    var this_width = this.width();
    var this_height = this.height();
    if (! (this_id in _d3_linechart_dict) )
    {
        _d3_linechart_dict[this_id] = d3_linechart()
            .parent(this)
            .parent_id(this_id)
            .width(this_width)
            .height(this_height)
    }
    return _d3_linechart_dict[this_id];
}