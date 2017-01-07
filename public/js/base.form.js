var manual_crop_is_pending = false;
var curr_crop_coords       = null;
var curr_crop_name         = null;
var curr_crop_element      = null;
var curr_crop_filename     = null;
var jcrop_api              = null;

$(document).ready(function() { 
    
    // give some weights & behaviors to the first few form fields
    var primary_element = $('.station-form input[type="text"]:first').not('.for-custom');
    var primary_element_val = primary_element.val();
    primary_element.addClass('input-hg').focus().val('').val(primary_element_val);

    $('.station-form input[type="text"]:eq(1), .station-form input[type="password"]:eq(0)').not('.for-custom').addClass('input-lg');

    // enable harvest/chosen JS lib on selects
    if ($(".chosen-select").length){

        $(".chosen-select[multiple='multiple']").prepend('<option value=""></option>');

        $(".chosen-select").chosen({
            disable_search_threshold: 10,
            allow_single_deselect: true
        });
    }

    // make radio buttons work with flatUI 
    $('.station-form input[type="radio"]').each(function () {

        $(this).attr('data-toggle', 'radio');
        $(this).radio();
    });

    // use masking plugin (below) to force some formatting
    $(".station-form input.phone").mask("(999) 999-9999? x99999");
    $(".station-form input.money").maskMoney({thousands:'', decimal:'.'});
    
    $('.station-form input.with-text-mask').each(function(index, el) {
        $(this).inputmask($(this).data('mask')); // more robust masking, if neededd.
    });

    // make date fields use datetime plugin 
    $('input.for-date').each(function(){

        var alt_field = '#' + $(this).attr('name');

        $(this).datetimeEntry({
                    
            datetimeFormat:     $(this).hasClass('with-time') ? 'N d Y H:M a' : 'N d Y', 
            altField:           alt_field, 
            altFormat:          $(this).hasClass('with-time') ? 'Y-O-D H:M:S' : 'Y-O-D',
            ampmPrefix:         ' ',
            spinnerImage:       '/packages/canary/station/js/query-datetime/spinnerDefault.png',
            spinnerSize:        [0,0,0],
            datetimeSeparators: ' ',
            useMouseWheel:      false
        });

        var starting_val = $(alt_field).val() == '' ? new Date() : mysqlTimeStampToDate($(alt_field).val());
        $(this).datetimeEntry('setDatetime', starting_val);

        $('.datetimeEntry_control').hide();
    });

    // enable date picker for date fields:
    $('input.for-date').each(function(){

        // jQuery UI Datepicker JS init
        var datepickerSelector = '#' + $(this).attr('id');
        $(datepickerSelector).datepicker({
          showOtherMonths: true,
          selectOtherMonths: true,
          dateFormat: $(this).hasClass('with-time') ? "MM d yy 12:00 A" : "MM d yy",
          altField: '#' + $(this).attr('name'),
          altFormat: 'yy-mm-dd'
        });

        // Now let's align datepicker with the prepend button
        $(datepickerSelector).datepicker('widget').css({'margin-left': -$(datepickerSelector).prev('span').outerWidth()});
    });

    // enable spinners
    $('.station-form input.spinner').customspinner({
      min: 0,
      max: 9999
        }).on('focus', function () {
          $(this).closest('.ui-spinner').addClass('focus');
        }).on('blur', function () {
          $(this).closest('.ui-spinner').removeClass('focus');
    });

    /**
     * media modal stuff!
     */
    $('body').on('click', '#mediaTab a', function (e) {
        e.preventDefault();
        $(this).tab('show');
    });

    $('body').on('click', '.station-media', function()
    {
        var $type = $(this).attr('id').split('_');
        //$('#mediaTab').tab();
        $('#mediaTab a[href="#'+$type[0]+'-tab"]').tab('show');
        var $elem_name = $(this).closest('.station-file-upload-wrap').find('.station-img-thumbnail:first').data('target');
        var $label = $('[for="station-'+$elem_name+'"]').html();
        $('#mediaModal [name="upload_element_name"]').val($elem_name);
        $('#mediaModal .modal-title').html($label);
        $('.station-file-options').hide();

        $('.trigger_img_upload').html('Upload File').show();



        $('#mediaModal').modal();

        if($type[0]=='upload') $('[name="uploaded_file"]').click();
        if($type[0]!='edit') $('#station-fileupload-hud').html('');
        if($type[0]=='edit')
        {
            // update upload button
            $('.trigger_img_upload').html('Upload Different File');

            //display image
            var $parts = $('#target-'+$elem_name).attr('src').split('/station_thumbs_sm/');
            $('#station-fileupload-hud').html('<img src="'+$parts[0]+'/station_thumbs_lg/'+$parts[1]+'">');

            // loading text for controls
            $('.station-file-options').html('<h5><span class="label label-primary">Loading...</span></h5>').show();

            // call func to gen tool buttons
            create_media_side_controls($parts[0] + '/',$parts[1], $elem_name, $elem_name, true, true);

            $('#mediaTab a:first').click();
        }
    });

    // embedder uploader, for embedding files into textareas
    $('.station-form .label-wrap a.for-embedder').click(function(event) {
        
        var parent = $(this).closest('.form-group');
        var embedder = parent.find('.snapped-to-textarea');

        if (embedder.is(':hidden')){

            parent.find('textarea').addClass('open');
            embedder.show();
            //embedder.find('.station-media-upload-btn').click();

        } else {

            parent.find('textarea').removeClass('open');
            embedder.hide();
        }

        $('.station-form .label-wrap a.for-embedder').toggle();

        return false;
    });

    $('.img-hidden-input').each(function()
    {
        var $elem_name = $(this).attr('name');
        //console.log($elem_name);
        var $img_hidden_val = $(this).val();
        if($img_hidden_val!='')
        {
            $('#target-'+$elem_name).attr('src','http://'+$('#target-'+$elem_name).attr('bucket')+'.s3.amazonaws.com/station_thumbs_sm/'+$img_hidden_val);
            $('#edit_for_' + $elem_name + ', #remove_for_' + $elem_name).show();
        }
    });

    $('body').on('click', '.trigger_img_upload', function()
    {
        $('[name="uploaded_file"]').click();
    });

    $('[name="uploaded_file"]').change(function()
    {
        //$('[name=postiframe]').remove();
        $('.trigger_img_upload').html('Processing....').attr('disabled','disabled');
        var $iframe = $('<iframe name="postiframe" id="postiframe" style="display: none" />');
        $("body").append($iframe);


        $('#station-fileupload-form').submit();

        $("#postiframe").load(function () {

                $iframeContents = $("#postiframe")[0].contentWindow.document.body.innerHTML;
                // console.log($iframeContents);
                $results = $.parseJSON($iframeContents);
                if ($results.success) 
                {
                    // console.log('success! ');
                    $('.trigger_img_upload').html('Upload Different File').removeAttr('disabled');
                    $('.station-file-options').show();
                    if(typeof $results.file_uri!='undefined')
                    {
                        // we display the thumb
                        $('#station-fileupload-hud').html('<img src="'+$results.file_uri_stub+'station_thumbs_lg/'+$results.file_name+'">');

                        //populate sidebar info
                        var $elem_name = $('#mediaModal [name="upload_element_name"]').val();

                        create_media_side_controls($results.file_uri_stub, $results.file_name, $elem_name, $results.is_embeddable, $results.is_image);
                        $(this).remove();


                    }
                    
                }
                else
                {
                    var $errors = response.error_list;
                    // // console.log($errors);
                    var $displayme = '<div class="alert alert-danger">'+$errors+'</div>';
                    //// // console.log($displayme);
                    $('#station-fileupload-hud').html($displayme);
                    scroll(0,0);


                }
        });
    });

    $('body').on('click', '.file-upload-save', function()
    {
        // Display on the main form
        var $elem_name = $('#mediaModal [name="upload_element_name"]').val();

        // we need the img filename and the uri
        var $parts = $('#station-fileupload-hud').children(':first').attr('src').split('/station_thumbs_lg/');
        $('#target-'+$elem_name).attr('src',$parts[0]+'/station_thumbs_sm/'+$parts[1]).show();
        
        if ($('[name='+$elem_name+']').is('textarea')){ // using the embedder tool

            $('#edit_for_' + $elem_name + ', #remove_for_' + $elem_name).show();
            $('.embedders-for-' + $elem_name).show();
            populate_embedder_buttons($elem_name, $parts);

        } else { // standard field upload tool

            $('#edit_for_' + $elem_name + ', #remove_for_' + $elem_name).show();
            $('[name='+$elem_name+']').val($parts[1]);
        }
    });

    $('body').on('click', '.file-remover', function(event) {
        
        var parent = $(this).closest('.station-element-group');
        var element_name = parent.attr('data-element-name');
        $('input[name="' + element_name + '"]').val('');
        parent.find('#edit_for_' + element_name + ', #remove_for_' + element_name).hide();
        parent.find('#target-' + element_name).attr('src', '/packages/canary/station/img/missing.gif');
        return false;
    });

    $('body').on('click', '.station-img-thumbnail', function(event) {
        
        var parent = $(this).closest('.station-file-upload-wrap');

        if (parent.find('button:visible:first').length){

            parent.find('button:visible:first').click();
        
        } else {

            parent.find('.station-media-upload-btn').click();
        }
        
        return false;
    });
    
    /**
     * manual cropping process using Jcrop
     *
     */
    $('body').on('click', '.station-crop-start', function(event) {
        
        if (manual_crop_is_pending){

            stop_crop_process();
        }

        if ($('#station-fileupload-hud img').length){

            manual_crop_is_pending = true;
            var crop_group         = $(this).closest('.station-crop-size-group');
            var size_string        = crop_group.attr('data-size');
            var size_name          = crop_group.attr('data-size-name');
            curr_crop_name         = size_name;
            curr_crop_element      = crop_group.attr('data-element-name');
            curr_crop_filename     = crop_group.attr('data-file-name');

            $('#station-fileupload-hud img').Jcrop(jcrop_options_for_size(size_string), function(){
                jcrop_api = this;
            });

            $(this).removeClass('btn-primary').addClass('btn-warning');
            $('.station-crop-start').removeClass('btn-primary').addClass('btn-default');

            var crop_saver_html = 

                '<div class="row station-crop-decider">'
                    + '<button type="button" class="pull-right station-crop-saver btn btn-primary btn-sm">Save Crop</button>'
                    + '<button type="button" class="pull-right station-crop-canceler btn btn-default btn-sm">Cancel</button>'
                + '</div>';

            $('#station-fileupload-hud').after(crop_saver_html);
            $('.modal-footer, .trigger_img_upload').hide();
        }

        return false;
    });

    $('body').on('click', '.station-crop-saver', function(event) {
        
        $.ajax({
          url: '/' + base_uri + 'file/crop/',
          type: 'PUT',
          data: { 
            panel_name    : curr_panel, 
            element_name  : curr_crop_element, 
            method        : curr_method,
            filename      : curr_crop_filename,
            coords        : curr_crop_coords,
            size_name     : curr_crop_name
          },

          success: function(data) {
            
          }
        });

        stop_crop_process();
        return false;
    });

    $('body').on('click', '.station-crop-canceler', function(event) {
        
        stop_crop_process();
        return false;
    });

    $('body').on('click', '.embedder-start', function(event){

        var href     = $(this).data('href');
        var type     = $(this).data('type');
        var wrap     = $('div[data-element-name="' + $(this).data('elem-name') + '"]');
        var markdown = type == 'image' ? '![alt text](' + href + ')' : '[link text](' + href + ')';

        // close modal
        $('.file-upload-save').click();

        var html = '<div class="embedder-md-wrap"><p>copy/paste this code where you want the file or link to appear:</p><input class="embedder-md" /></div>';

        if (type != 'image') wrap.find('.station-img-thumbnail').attr('src', '/packages/canary/station/img/file-placeholder.png');

        wrap.find('.embedder-md-wrap').remove();
        wrap.find('.station-file-upload-wrap').append(html);
        wrap.find('.embedder-md').val(markdown).focus().select().click(function(event) {
            
            $(this).select();
        });

        return false;
    });

    /**
     * sub-panel methods
     */
    $('.sub-panel-adder').click(function(event) {
        
        $('.sub-panel-adder').removeClass('active');
        $(this).addClass('active');
        $(this).blur().find('span:last').html('loading...');
        submit_form().done(handle_submitted_form_for_sub_panel);
        return false;
    });

    $('.markdown-helper').click(function(event) {
        
        $('#markdown-helper-modal').modal();
    });

    /**
     * URL fetching
     */
    $('.url-fetch-target').change(function(event) {
        
        $('.fetch-status').remove();
        $(this).closest('.input-group').find('.fetcher').append('<span class="fetch-status"> loading...</span>');
        var element_name = $(this).attr('data-element');

        $.ajax({

            url: '/' + base_uri + 'panel/' + curr_panel + '/process_url/' + element_name,
            type: 'PUT',
            dataType: 'json',
            data: { url: $(this).val(), subpanel: curr_subpanel },
        })
        .done(function(r) {
            
            $('.fetch-status').remove();
            disperse_fetched_url_parts(r, element_name);
            set_fetched_url_data(element_name);
        });
    });

    $('.url-fetch-target').each(function(index, el) {
        
        $(this).keypress(function(event) { return event.keyCode != 13; });
        var element_name = $(this).attr('data-element');
        set_fetched_url_data(element_name);
    });

    $('.url-fetch-target').click(function(event) {
        
        $(this).select();
    });

    $('.fetcher').click(function(event) {
        
        $(this).closest('.input-group').find('.url-fetch-target').change();
    });

    load_clipboard_behaviors();
    init_tabs();
});

/**
 * for tabs
 */
    function init_tabs(){

        var tab_groups = [];

        $('.station-element-group').each(function(index, el) {
            var group_name = $(this).data('element-group');
            if ($.inArray(group_name, tab_groups) == -1) tab_groups.push(group_name);
        });

        if (tab_groups.length > 1){

            $('.station-form').before('<div class="station-group-tabs"></div>');

            $.each(tab_groups, function(index, val) {
                $('.station-group-tabs').append('<a href="javascript:;" data-rel="' + val + '">' + val + '</a>');
            });

            $('.station-group-tabs a').click(function(event) {
                group_tab_click($(this).html());
                return false;
            });

            $('.station-group-tabs a:first').click();

            var is_creating = typeof $('.station-form input[name="_method"]').val() == 'undefined';

            if (!is_creating){

                $('.station-form').submit(function(event) {

                    $(this).find('button.station-form-submit').hide();
                    $(this).find('button.station-form-submit[name="after_save"]').html('Saving...').show();

                    $.ajax({
                        url: $(this).attr('action'),
                        type: 'POST',
                        dataType: 'html',
                        data: $(this).serialize(),
                    })
                    .done(function() {
                        $('.station-form').find('button.station-form-submit[name="after_save"]').html('Saved. Save Again?').blur();
                    });
                    
                    return false;
                });
            }
        }
    }

    function group_tab_click(group){

        var tabs    = $('.station-group-tabs a');
        var tab     = $('.station-group-tabs a[data-rel="' + group + '"]');
        var els     = $('.station-element-group[data-element-group="' + group + '"]');
        var all_els = $('.station-element-group');

        tabs.removeClass('active');
        tab.addClass('active');

        all_els.hide();
        els.show();

        window.location = '#' + group.split(' ').join('+');;
    }

/**
 * for url fetching
 */
    function disperse_fetched_url_parts(parts, element_name){

        eval('var mapping = ' + $('.parsed-results[data-element="' + element_name + '"]').attr('data-mapping'));
        
        $.each(mapping, function(index, val) {
            
            if (typeof parts.graph != 'undefined' && typeof parts.graph[index] != 'undefined') {

                $('input[name="' + val + '"]').val(parts.graph[index]);
            
            } else {

                $('input[name="' + val + '"]').val('');
            }

            if (index == 'image'){

                var thumbnail = $('.station-element-group[data-element-name="' + element_name + '"] .station-img-thumbnail');

                if (typeof parts.graph != 'undefined' && typeof parts.graph[index] != 'undefined') {

                    var src = 'http://' + thumbnail.attr('bucket') + '.s3.amazonaws.com/station_thumbs_sm/' + parts.graph[index];
                    
                } else {

                    var src = '/packages/canary/station/img/missing.gif';
                }

                thumbnail.attr('src', src);
            }
        });
    }

    function set_fetched_url_data(element_name){

        eval('var mapping = ' + $('.parsed-results[data-element="' + element_name + '"]').attr('data-mapping'));

        $.each(mapping, function(index, val) {

            var parent = $('.station-element-group[data-element-name="' + element_name + '"]');
            var field_value = $('input[name="' + val + '"]').val();

            if (index == 'title'){

                parent.find('.parsed-results').html('<span class="label label-default">' + field_value + '</span>');
            }

            if (index == 'url'){

                parent.find('.url-fetch-target').val(field_value);

                if (field_value == ''){

                    parent.find('.station-file-upload-controls').hide();
                
                } else {

                    parent.find('.station-file-upload-controls').show();
                }
            }
        });
    }

/**
 * ajax form handling
 */

    function handle_submitted_form_for_sub_panel(r){

        var curr_sub_panel_adder = $('.sub-panel-adder.active');

        if (r.status != 1){ // failed to add or update parent panel record

            var single_item_name = curr_sub_panel_adder.attr('data-single-item-name');
            var initial_label = curr_sub_panel_adder.attr('data-initial-label');

            $('.flash-response, .alert').hide(); // hide any other flashes on the page first
            $('.empty-flash-holder').html(r.flash).show();
            $('.empty-flash-holder b:first').prepend('Before you can add a new ' + single_item_name.toLowerCase() + ', ');
            $('html, body').animate({ scrollTop: 0 }, 200); // scroll to top
            curr_sub_panel_adder.find('span:last').html(initial_label);
        
        } else { // we successfully added / updated the parent record for the sub panel, let's redirect to the child 

            var sub_panel_name = curr_sub_panel_adder.attr('data-panel-name');
            window.location = '/' + base_uri + 'panel/' + sub_panel_name + '/create/for/' + curr_panel + '/' + r.record_id;
        }
    }

    function submit_form(){

        var form   = $('.station-form');
        var method = form.attr('method');
        var action = form.attr('action');

        return $.ajax({
            url: action,
            type: method,
            data: form.serialize(),
            dataType: 'json'
        });
    }

/**
 * cropping related methods
 *
 * @param  type  $param
 * @return void
 */

    function set_crop_coords(c){
        
        curr_crop_coords = c; // format is: c.x, c.y, c.x2, c.y2, c.w, c.h
    }

    function stop_crop_process(){

        jcrop_api.destroy();
        $('.station-crop-decider').remove();
        $('.station-crop-start').removeClass('btn-default').removeClass('btn-warning').addClass('btn-primary');
        $('.modal-footer, .trigger_img_upload').show();
        manual_crop_is_pending = false;
    }

    function jcrop_options_for_size(size_string){

        var size_arr = size_string.split('x');
        var x        = parseInt(size_arr[0]);
        var y        = parseInt(size_arr[1]);
        var padding  = 10;

        if (x == 0 || y == 0){ // not a fixed width

            return {

                onSelect: set_crop_coords, 
                setSelect: [padding, padding, 100 + padding, 100 + padding] 
            }

        } else {

            var forced_height = 100; // let's keep it small in case we have a short and wide image
            var x2 = ((x * forced_height) / y) + padding; // find the width based on our aspect ratio and forced height 
            var y2 = forced_height + padding;

            return {
             
                onSelect: set_crop_coords, 
                setSelect: [10, 10, x2, y2],
                aspectRatio: x / y
            }
        }
    }

/**
 * for uploading
 */

    
    function create_media_side_controls($stub,$filename,$elem_name,$is_embeddable, $is_image)
    {
        // now need to dynamically make the column of size buttons on modal and in img form
        var $img_sizes = $.parseJSON($('[name=img_sizes_array]').val());
        var $this_img_sizes = Array();
        //$this_img_sizes = $img_sizes.standard;

        // keep it simple. if we have image sizes for this element, use them...
        if (typeof $img_sizes[$elem_name] != 'undefined'){

            for(i in $img_sizes[$elem_name])
            {
                $this_img_sizes.push([i,$img_sizes[$elem_name][i].label,$img_sizes[$elem_name][i].size]);
            }
        
        } else { // if we don't have image sizes for this element, use the standards. no overrides.

            for(i in $img_sizes.standard)
            {
                $this_img_sizes.push([i,$img_sizes.standard[i].label,$img_sizes.standard[i].size]);
            }
        }

        // now we can set the hidden element to the img upload form
        $('[name=img_sizes]').val(JSON.stringify($this_img_sizes));

        // now we need to create the buttons in sidenav for resizing
        var $button_html = '';

        if ($is_image){

            for(var $j=0 ; $j < $this_img_sizes.length ; $j++){

                var has_size = typeof $this_img_sizes[$j][2] != 'undefined';
                var size_class = !has_size ? 'w-no-size' : '';

                $button_html +=

                    '<div class="btn-group station-crop-size-group ' + size_class + '" data-file-name="' + $filename + '" '
                            + 'data-element-name="' + $elem_name + '" data-size-name="' + $this_img_sizes[$j][0] + '" data-size="' + $this_img_sizes[$j][2] + '">\n'
                        + '<button type="button" class="btn btn-xs btn-primary station-crop-start" id="station-filecrop-'+$this_img_sizes[$j][0]+'">'
                            + '<span class="glyphicon glyphicon-pencil"></span>'
                        + '</button>\n'
                        + '<a target="_blank" href="' + $stub + $this_img_sizes[$j][0] + '/' + $filename + '" class="btn btn-xs btn-default" '
                                + 'id="station-fileview-'+ $this_img_sizes[$j][0] + '">'
                            + '<span class="glyphicon glyphicon-eye-open img-crop-version-eyeball">&nbsp;</span> '
                            + '<span class="img-crop-version-label">' + $this_img_sizes[$j][1] + '</span>'
                        + '</a>\n'
                    + '</div>\n';        
            }
        }

        if ($is_embeddable){

            if ($is_image){

                var embed_header = '';
                $button_html += '<h5>Choose Version to Embed:</h5>';
                $button_html += '<p>Click a size to get the embed code.</p>';

                for(var $j=0 ; $j < $this_img_sizes.length ; $j++){

                    var has_size = typeof $this_img_sizes[$j][2] != 'undefined';
                    var size_class = !has_size ? 'w-no-size' : '';

                    $button_html +=

                        '<div class="btn-group btn-success station-crop-size-group" data-file-name="' + $filename + '" '
                                + 'data-element-name="' + $elem_name + '" data-size-name="' + $this_img_sizes[$j][0] + '" data-size="' + $this_img_sizes[$j][2] + '">\n'
                            + '<a data-type="image" data-href="' + $stub + $this_img_sizes[$j][0] + '/' + $filename + '" class="btn btn-xs btn-success embedder-start" '
                                    + 'data-elem-name="' + $elem_name + '">'
                                + '<span class="img-crop-version-label">' + $this_img_sizes[$j][1] + '</span>'
                            + '</a>\n'
                        + '</div>\n';        
                }

            } else { // it's a file

                $button_html +=

                    '<div class="btn-group btn-success station-crop-size-group" data-file-name="' + $filename + '" '
                            + 'data-element-name="' + $elem_name + '">\n'
                        + '<a data-type="file" data-href="' + $stub + 'files/' + $filename + '" class="btn btn-xs btn-success embedder-start" '
                                + 'data-elem-name="' + $elem_name + '">'
                        + '</a>\n'
                    + '</div>\n'; 

                // close modal if embedder trigger is there:
                $('.station-file-options').html($button_html);
                $('.embedder-start:first').click();
            }
        }

        $('.station-file-options').html($button_html);

        $('.btn-group.w-no-size .station-crop-start').remove();
    }


/**
 * for clipboard behaviors
 */

    function load_clipboard_behaviors(){

        if ($('.embedder-btn').length){

            var clip = new ZeroClipboard($('.embedder-btn'), { moviePath: "/packages/canary/station/js/zeroclipboard-1.3.5/ZeroClipboard.swf" });

            clip.on( 'complete', function(client, args) {

                $('.embedder-btn').removeClass('btn-warning').removeClass('btn-success').addClass('btn-default').find('span.copied-message').remove();
                $(this).addClass('btn-success');
                $(this).append('<span class="copied-message"> | Code Copied to Clipboard!</span>');
                $(this).blur();
                return false;
            });
        }
    }

    function populate_embedder_buttons($elem_name, $parts){

        $('.embedders-for-' + $elem_name + ' .embedder-btn').data('clipboard-template', $parts[0]+'/%stub%/'+$parts[1]);

        $('.embedders-for-' + $elem_name + ' .embedder-btn').each(function(index, el) {
            
            var url = encodeURI($(this).data('clipboard-template').replace('%stub%', $(this).data('stub')));
            var markdown = '![Image Title](' + url + ')';
            $(this).attr('data-clipboard-text', markdown);
        });
    }

/**
 * misc 
 */
    function mysqlTimeStampToDate(timestamp) {
        
        if (timestamp == '0000-00-00'){

            return '';
        }

        if (timestamp.length > 10){

            var regex=/^([0-9]{2,4})-([0-1][0-9])-([0-3][0-9]) (?:([0-2][0-9]):([0-5][0-9]):([0-5][0-9]))?$/;
            var parts=timestamp.replace(regex,"$1 $2 $3 $4 $5 $6").split(' ');

            return new Date(parts[0],parts[1]-1,parts[2],parts[3],parts[4],parts[5]);
        
        } else {
            
            var regex=/^([0-9]{2,4})-([0-1][0-9])-([0-3][0-9]) ?$/;
            var parts=timestamp.replace(regex,"$1 $2 $3").split(' ');
            return new Date(parts[0],parts[1]-1,parts[2]);
        }
    }

/**
 * https://github.com/RobinHerbots/jquery.inputmask
 */
(function(e){if(e.fn.inputmask===undefined){function t(e){var t=document.createElement("input"),e="on"+e,n=e in t;if(!n){t.setAttribute(e,"return;");n=typeof t[e]=="function"}t=null;return n}function n(t,r,i){var s=i.aliases[t];if(s){if(s.alias)n(s.alias,undefined,i);e.extend(true,i,s);e.extend(true,i,r);return true}return false}function r(t,n){function i(e){function i(e,t,n,r){this.matches=[];this.isGroup=e||false;this.isOptional=t||false;this.isQuantifier=n||false;this.isAlternator=r||false;this.quantifier={min:1,max:1}}function s(e,n,i){var s=t.definitions[n];var o=e.matches.length==0;i=i!=undefined?i:e.matches.length;if(s&&!r){var u=s["prevalidator"],a=u?u.length:0;for(var f=1;f<s.cardinality;f++){var l=a>=f?u[f-1]:[],c=l["validator"],h=l["cardinality"];e.matches.splice(i++,0,{fn:c?typeof c=="string"?new RegExp(c):new function(){this.test=c}:new RegExp("."),cardinality:h?h:1,optionality:e.isOptional,newBlockMarker:o,casing:s["casing"],def:s["definitionSymbol"]||n,placeholder:s["placeholder"],mask:n})}e.matches.splice(i++,0,{fn:s.validator?typeof s.validator=="string"?new RegExp(s.validator):new function(){this.test=s.validator}:new RegExp("."),cardinality:s.cardinality,optionality:e.isOptional,newBlockMarker:o,casing:s["casing"],def:s["definitionSymbol"]||n,placeholder:s["placeholder"],mask:n})}else{e.matches.splice(i++,0,{fn:null,cardinality:0,optionality:e.isOptional,newBlockMarker:o,casing:null,def:n,placeholder:undefined,mask:n});r=false}}var n=/(?:[?*+]|\{[0-9\+\*]+(?:,[0-9\+\*]*)?\})\??|[^.?*+^${[]()|\\]+|./g,r=false;var o=new i,u,a,f=[],l=[],c;while(u=n.exec(e)){a=u[0];switch(a.charAt(0)){case t.optionalmarker.end:case t.groupmarker.end:c=f.pop();if(f.length>0){f[f.length-1]["matches"].push(c)}else{o.matches.push(c)}break;case t.optionalmarker.start:f.push(new i(false,true));break;case t.groupmarker.start:f.push(new i(true));break;case t.quantifiermarker.start:var h=new i(false,false,true);a=a.replace(/[{}]/g,"");var p=a.split(","),d=isNaN(p[0])?p[0]:parseInt(p[0]),v=p.length==1?d:isNaN(p[1])?p[1]:parseInt(p[1]);if(v=="*"||v=="+"){d=v=="*"?0:1}h.quantifier={min:d,max:v};if(f.length>0){var m=f[f.length-1]["matches"];u=m.pop();if(!u["isGroup"]){var g=new i(true);g.matches.push(u);u=g}m.push(u);m.push(h)}else{u=o.matches.pop();if(!u["isGroup"]){var g=new i(true);g.matches.push(u);u=g}o.matches.push(u);o.matches.push(h)}break;case t.escapeChar:r=true;break;case t.alternatormarker:var y=new i(false,false,false,true);if(f.length>0){var m=f[f.length-1]["matches"];u=m.pop();y.matches.push(u);f.push(y)}else{u=o.matches.pop();y.matches.push(u);f.push(y)}break;default:if(f.length>0){s(f[f.length-1],a);var b=f[f.length-1];if(b["isAlternator"]){c=f.pop();for(var w=0;w<c.matches.length;w++){c.matches[w].isGroup=false}if(f.length>0){f[f.length-1]["matches"].push(c)}else{o.matches.push(c)}}}else{if(o.matches.length>0){var E=o.matches[o.matches.length-1];if(E["isGroup"]){E.isGroup=false;s(E,t.groupmarker.start,0);s(E,t.groupmarker.end)}}s(o,a)}}}if(f.length>0){var b=f[f.length-1];if(b["isAlternator"]){for(var w=0;w<b.matches.length;w++){b.matches[w].isGroup=false}}o.matches=o.matches.concat(f)}if(o.matches.length>0){var E=o.matches[o.matches.length-1];if(E["isGroup"]){E.isGroup=false;s(E,t.groupmarker.start,0);s(E,t.groupmarker.end)}l.push(o)}return l}function s(n,r){if(t.numericInput&&t.multi!==true){n=n.split("").reverse();for(var s=0;s<n.length;s++){if(n[s]==t.optionalmarker.start)n[s]=t.optionalmarker.end;else if(n[s]==t.optionalmarker.end)n[s]=t.optionalmarker.start;else if(n[s]==t.groupmarker.start)n[s]=t.groupmarker.end;else if(n[s]==t.groupmarker.end)n[s]=t.groupmarker.start}n=n.join("")}if(n==undefined||n=="")return undefined;else{if(t.repeat>0||t.repeat=="*"||t.repeat=="+"){var o=t.repeat=="*"?0:t.repeat=="+"?1:t.repeat;n=t.groupmarker.start+n+t.groupmarker.end+t.quantifiermarker.start+o+","+t.repeat+t.quantifiermarker.end}if(e.inputmask.masksCache[n]==undefined){e.inputmask.masksCache[n]={mask:n,maskToken:i(n),validPositions:{},_buffer:undefined,buffer:undefined,tests:{},metadata:r}}return e.extend(true,{},e.inputmask.masksCache[n])}}var r=[];if(e.isFunction(t.mask)){t.mask=t.mask.call(this,t)}if(e.isArray(t.mask)){if(n){e.each(t.mask,function(e,t){if(t["mask"]!=undefined){r.push(s(t["mask"].toString(),t))}else{r.push(s(t.toString()))}})}else{var o="("+t.mask.join(")|(")+")";r=s(o)}}else{if(t.mask.length==1&&t.greedy==false&&t.repeat!=0){t.placeholder=""}if(t.mask["mask"]!=undefined){r=s(t.mask["mask"].toString(),t.mask)}else{r=s(t.mask.toString())}}return r}var i=typeof ScriptEngineMajorVersion==="function"?ScriptEngineMajorVersion():(new Function("/*@cc_on return @_jscript_version; @*/"))()>=10,s=navigator.userAgent,o=s.match(new RegExp("iphone","i"))!==null,u=s.match(new RegExp("android.*safari.*","i"))!==null,a=s.match(new RegExp("android.*chrome.*","i"))!==null,f=s.match(new RegExp("android.*firefox.*","i"))!==null,l=/Kindle/i.test(s)||/Silk/i.test(s)||/KFTT/i.test(s)||/KFOT/i.test(s)||/KFJWA/i.test(s)||/KFJWI/i.test(s)||/KFSOWI/i.test(s)||/KFTHWA/i.test(s)||/KFTHWI/i.test(s)||/KFAPWA/i.test(s)||/KFAPWI/i.test(s),c=t("paste")?"paste":t("input")?"input":"propertychange";function h(t,n,r){function y(e,t,n){t=t||0;var i=[],s,o=0,u,a;do{if(e===true&&b()["validPositions"][o]){var f=b()["validPositions"][o];u=f["match"];s=f["locator"].slice();i.push(u["fn"]==null?u["def"]:n===true?f["input"]:u["placeholder"]||r.placeholder.charAt(o%r.placeholder.length))}else{if(t>o){var l=k(o,s,o-1);a=l[0]}else{a=T(o,s,o-1)}u=a["match"];s=a["locator"].slice();i.push(u["fn"]==null?u["def"]:u["placeholder"]||r.placeholder.charAt(o%r.placeholder.length))}o++}while((g==undefined||o-1<g)&&u["fn"]!=null||u["fn"]==null&&u["def"]!=""||t>=o);i.pop();return i}function b(){return n}function w(e){var t=b();t["buffer"]=undefined;t["tests"]={};if(e!==true){t["_buffer"]=undefined;t["validPositions"]={};t["p"]=-1}}function E(e){var t=b(),n=-1,r=t["validPositions"];if(e==undefined)e=-1;var i=n,s=n;for(var o in r){var u=parseInt(o);if(e==-1||r[u]["match"].fn!=null){if(u<e)i=u;if(u>=e)s=u}}n=e-i>1||s<e?i:s;return n}function S(t,n,i){if(r.insertMode&&b()["validPositions"][t]!=undefined&&i==undefined){var s=e.extend(true,{},b()["validPositions"]),o=E(),u;for(u=t;u<=o;u++){delete b()["validPositions"][u]}b()["validPositions"][t]=n;var a=true;for(u=t;u<=o;u++){var f=s[u];if(f!=undefined){var l=f["match"].fn==null?u+1:H(u);if(C(l,f["match"].def)){a=a&&_(l,f["input"],true,true)!==false}else a=false}if(!a)break}if(!a){b()["validPositions"]=e.extend(true,{},s);return false}}else b()["validPositions"][t]=n;return true}function x(e,t){var n,r=e,i;for(n=e;n<t;n++){delete b()["validPositions"][n]}for(n=t;n<=E();){var s=b()["validPositions"][n];var o=b()["validPositions"][r];if(s!=undefined&&o==undefined){if(C(r,s.match.def)&&_(r,s["input"],true)!==false){delete b()["validPositions"][n];n++}r++}else n++}i=E();while(i>0&&(b()["validPositions"][i]==undefined||b()["validPositions"][i].match.fn==null)){delete b()["validPositions"][i];i--}w(true)}function T(e,t,n){var i=k(e,t,n),s;for(var o=0;o<i.length;o++){s=i[o];if(r.greedy||s["match"]&&(s["match"].optionality===false||s["match"].newBlockMarker===false)&&s["match"].optionalQuantifier!==true){break}}return s}function N(e){if(b()["validPositions"][e]){return b()["validPositions"][e]["match"]}return k(e)[0]["match"]}function C(e,t){var n=false,r=k(e);for(var i=0;i<r.length;i++){if(r[i]["match"]&&r[i]["match"].def==t){n=true;break}}return n}function k(t,n,i){function l(n,i,s,u){function c(s,u,p){if(o==t&&s.matches==undefined){a.push({match:s,locator:u.reverse()});return true}else if(s.matches!=undefined){if(s.isGroup&&p!==true){s=c(n.matches[h+1],u);if(s)return true}else if(s.isOptional){var d=s;s=l(s,i,u,p);if(s){var v=a[a.length-1]["match"];var m=e.inArray(v,d.matches)==0;if(m){f=true}o=t}}else if(s.isAlternator){var g=s;var y=a.slice(),b,w,E=u.length;var S=i.length>0?i.shift():-1;if(S==-1){var x=o;a=[];s=l(g.matches[0],i.slice(),[0].concat(u),p);b=a.slice();o=x;a=[];s=l(g.matches[1],i,[1].concat(u),p);w=a.slice();a=[];for(var T=0;T<b.length;T++){var N=b[T];y.push(N);for(var C=0;C<w.length;C++){var k=w[C];if(N.match.mask==k.match.mask){w.splice(C,1);N.locator[E]=-1;break}}}a=y.concat(w)}else{s=c(g.matches[S],[S].concat(u),p)}if(s)return true}else if(s.isQuantifier&&p!==true){var L=s;r.greedy=r.greedy&&isFinite(L.quantifier.max);for(var A=i.length>0&&p!==true?i.shift():0;A<(isNaN(L.quantifier.max)?A+1:L.quantifier.max)&&o<=t;A++){var O=n.matches[e.inArray(L,n.matches)-1];s=c(O,[A].concat(u),true);if(s){var v=a[a.length-1]["match"];v.optionalQuantifier=A>L.quantifier.min-1;var m=e.inArray(v,O.matches)==0;if(m){if(A>L.quantifier.min-1){f=true;o=t;break}else return true}else{return true}}}}else{s=l(s,i,u,p);if(s)return true}}else o++}for(var h=i.length>0?i.shift():0;h<n.matches.length;h++){if(n.matches[h]["isQuantifier"]!==true){var p=c(n.matches[h],[h].concat(s),u);if(p&&o==t){return p}else if(o>t){break}}}}var s=b()["maskToken"],o=n?i:0,u=n||[0],a=[],f=false;if(n==undefined){var c=t-1,h;while((h=b()["validPositions"][c])==undefined&&c>-1){c--}if(h!=undefined&&c>-1){o=c;u=h["locator"].slice()}else{c=t-1;while((h=b()["tests"][c])==undefined&&c>-1){c--}if(h!=undefined&&c>-1){o=c;u=h[0]["locator"].slice()}}}for(var p=u.shift();p<s.length;p++){var d=l(s[p],u,[p]);if(d&&o==t||o>t){break}}if(a.length==0||f)a.push({match:{fn:null,cardinality:0,optionality:true,casing:null,def:""},locator:[]});b()["tests"][t]=a;return a}function L(){if(b()["_buffer"]==undefined){b()["_buffer"]=y(false,1)}return b()["_buffer"]}function A(){if(b()["buffer"]==undefined){b()["buffer"]=y(true,E(),true)}return b()["buffer"]}function O(e,t){var n=A().slice();if(e===true){w();e=0;t=n.length}else{for(var i=e;i<t;i++){delete b()["validPositions"][i];delete b()["tests"][i]}}for(var i=e;i<t;i++){if(n[i]!=r.skipOptionalPartCharacter){_(i,n[i],true,true)}}}function M(e,t){switch(t.casing){case"upper":e=e.toUpperCase();break;case"lower":e=e.toLowerCase();break}return e}function _(t,n,i,s){function o(t,n,i,s){var o=false;e.each(k(t),function(u,a){var f=a["match"];var l=n?1:0,c="",h=A();for(var p=f.cardinality;p>l;p--){c+=j(t-(p-1))}if(n){c+=n}o=f.fn!=null?f.fn.test(c,b(),t,i,r):(n==f["def"]||n==r.skipOptionalPartCharacter)&&f["def"]!=""?{c:f["def"],pos:t}:false;if(o!==false){var d=o.c!=undefined?o.c:n;d=d==r.skipOptionalPartCharacter&&f["fn"]===null?f["def"]:d;var v=t;if(o["remove"]!=undefined){x(o["remove"],o["remove"]+1)}if(o["refreshFromBuffer"]){var m=o["refreshFromBuffer"];i=true;O(m===true?m:m["start"],m["end"]);if(o.pos==undefined&&o.c==undefined){o.pos=E();return false}v=o.pos!=undefined?o.pos:t;if(v!=t){o=e.extend(o,_(v,d,true));return false}}else if(o!==true&&o.pos!=undefined&&o["pos"]!=t){v=o["pos"];O(t,v);if(v!=t){o=e.extend(o,_(v,d,true));return false}}if(o!=true&&o.pos==undefined&&o.c==undefined){return false}if(u>0){w(true)}if(!S(v,e.extend({},a,{input:M(d,f)}),s))o=false;return false}});return o}i=i===true;var u=A();for(var a=t-1;a>-1;a--){if(b()["validPositions"][a]&&b()["validPositions"][a].fn==null)break;else if((!D(a)||u[a]!=I(a))&&k(a).length>1){o(a,u[a],true);break}}var f=t;if(f>=P()){return false}var l=o(f,n,i,s);if(!i&&l===false){var c=b()["validPositions"][f];if(c&&c["match"].fn==null&&(c["match"].def==n||n==r.skipOptionalPartCharacter)){l={caret:H(f)}}else if((r.insertMode||b()["validPositions"][H(f)]==undefined)&&!D(f)){for(var h=f+1,p=H(f);h<=p;h++){l=o(h,n,i,s);if(l!==false){f=h;break}}}}if(l===true)l={pos:f};return l}function D(e){var t=N(e);return t.fn!=null?t.fn:false}function P(){var e;g=p.prop("maxLength");if(g==-1)g=undefined;if(r.greedy==false){var t,n=E(),i=b()["validPositions"][n],s=i!=undefined?i["locator"].slice():undefined;for(t=n+1;i==undefined||i["match"]["fn"]!=null||i["match"]["fn"]==null&&i["match"]["def"]!="";t++){i=T(t,s,t-1);s=i["locator"].slice()}e=t}else e=A().length;return g==undefined||e<g?e:g}function H(e){var t=P();if(e>=t)return t;var n=e;while(++n<t&&!D(n)&&(r.nojumps!==true||r.nojumpsThreshold>n)){}return n}function B(e){var t=e;if(t<=0)return 0;while(--t>0&&!D(t)){}return t}function j(e){return b()["validPositions"][e]==undefined?I(e):b()["validPositions"][e]["input"]}function F(e,t,n){e._valueSet(t.join(""));if(n!=undefined){X(e,n)}}function I(e,t){t=t||N(e);return t["placeholder"]||(t["fn"]==null?t["def"]:r.placeholder.charAt(e%r.placeholder.length))}function q(t,n,i,s,o){var u=s!=undefined?s.slice():U(t._valueGet()).split("");w();if(n)t._valueSet("");e.each(u,function(n,r){if(o===true){var s=b()["p"],u=s==-1?s:B(s),a=u==-1?n:H(u);if(e.inArray(r,L().slice(u+1,a))==-1){nt.call(t,undefined,true,r.charCodeAt(0),false,i,n)}}else{nt.call(t,undefined,true,r.charCodeAt(0),false,i,n);i=i||n>0&&n>b()["p"]}});if(n){var a=r.onKeyPress.call(this,undefined,A(),0,r);et(t,a);F(t,A(),e(t).is(":focus")?H(E(0)):undefined)}}function R(t){return e.inputmask.escapeRegex.call(this,t)}function U(e){return e.replace(new RegExp("("+R(L().join(""))+")*$"),"")}function z(t){if(t.data("_inputmask")&&!t.hasClass("hasDatepicker")){var n=[],i=b()["validPositions"];for(var o in i){if(i[o]["match"]&&i[o]["match"].fn!=null){n.push(i[o]["input"])}}var u=(s?n.reverse():n).join("");var a=(s?A().reverse():A()).join("");if(e.isFunction(r.onUnMask)){u=r.onUnMask.call(t,a,u,r)}return u}else{return t[0]._valueGet()}}function W(e){if(s&&typeof e=="number"&&(!r.greedy||r.placeholder!="")){var t=A().length;e=t-e}return e}function X(t,n,i){var s=t.jquery&&t.length>0?t[0]:t,o;if(typeof n=="number"){n=W(n);i=W(i);i=typeof i=="number"?i:n;var u=e(s).data("_inputmask")||{};u["caret"]={begin:n,end:i};e(s).data("_inputmask",u);if(!e(s).is(":visible")){return}s.scrollLeft=s.scrollWidth;if(r.insertMode==false&&n==i)i++;if(s.setSelectionRange){s.selectionStart=n;s.selectionEnd=i}else if(s.createTextRange){o=s.createTextRange();o.collapse(true);o.moveEnd("character",i);o.moveStart("character",n);o.select()}}else{var u=e(s).data("_inputmask");if(!e(s).is(":visible")&&u&&u["caret"]!=undefined){n=u["caret"]["begin"];i=u["caret"]["end"]}else if(s.setSelectionRange){n=s.selectionStart;i=s.selectionEnd}else if(document.selection&&document.selection.createRange){o=document.selection.createRange();n=0-o.duplicate().moveStart("character",-1e5);i=n+o.text.length}n=W(n);i=W(i);return{begin:n,end:i}}}function V(t){var n=A(),r=n.length,i,s=E(),o={},u=b()["validPositions"][s]!=undefined?b()["validPositions"][s]["locator"].slice():undefined,a;for(i=s+1;i<n.length;i++){a=T(i,u,i-1);u=a["locator"].slice();o[i]=e.extend(true,{},a)}for(i=r-1;i>s;i--){a=o[i]["match"];if((a.optionality||a.optionalQuantifier)&&n[i]==I(i,a)){r--}else break}return t?{l:r,def:o[r]?o[r]["match"]:undefined}:r}function J(e){var t=A(),n=t.slice();var r=V();n.length=r;F(e,n)}function K(t){if(e.isFunction(r.isComplete))return r.isComplete.call(p,t,r);if(r.repeat=="*")return undefined;var n=false,i=V(true),s=B(i["l"]),o=E();if(o==s){if(i["def"]==undefined||i["def"].newBlockMarker||i["def"].optionalQuantifier){n=true;for(var u=0;u<=s;u++){var a=D(u);if(a&&(t[u]==undefined||t[u]==I(u))||!a&&t[u]!=I(u)){n=false;break}}}}return n}function Q(e,t){return s?e-t>1||e-t==1&&r.insertMode:t-e>1||t-e==1&&r.insertMode}function G(t){var n=e._data(t).events;e.each(n,function(t,n){e.each(n,function(e,t){if(t.namespace=="inputmask"){if(t.type!="setvalue"){var n=t.handler;t.handler=function(e){if(this.readOnly||this.disabled)e.preventDefault;else return n.apply(this,arguments)}}}})})}function Y(t){function n(t){if(e.valHooks[t]==undefined||e.valHooks[t].inputmaskpatch!=true){var n=e.valHooks[t]&&e.valHooks[t].get?e.valHooks[t].get:function(e){return e.value};var r=e.valHooks[t]&&e.valHooks[t].set?e.valHooks[t].set:function(e,t){e.value=t;return e};e.valHooks[t]={get:function(t){var r=e(t);if(r.data("_inputmask")){if(r.data("_inputmask")["opts"].autoUnmask)return r.inputmask("unmaskedvalue");else{var i=n(t),s=r.data("_inputmask"),o=s["maskset"],u=o["_buffer"];u=u?u.join(""):"";return i!=u?i:""}}else return n(t)},set:function(t,n){var i=e(t),s=i.data("_inputmask"),o;if(s){o=r(t,e.isFunction(s["opts"].onBeforeMask)?s["opts"].onBeforeMask.call(lt,n,s["opts"]):n);i.triggerHandler("setvalue.inputmask")}else{o=r(t,n)}return o},inputmaskpatch:true}}}var r;if(Object.getOwnPropertyDescriptor)r=Object.getOwnPropertyDescriptor(t,"value");if(r&&r.get){if(!t._valueGet){var i=r.get;var o=r.set;t._valueGet=function(){return s?i.call(this).split("").reverse().join(""):i.call(this)};t._valueSet=function(e){o.call(this,s?e.split("").reverse().join(""):e)};Object.defineProperty(t,"value",{get:function(){var t=e(this),n=e(this).data("_inputmask");if(n){return n["opts"].autoUnmask?t.inputmask("unmaskedvalue"):i.call(this)!=L().join("")?i.call(this):""}else return i.call(this)},set:function(t){var n=e(this).data("_inputmask");if(n){o.call(this,e.isFunction(n["opts"].onBeforeMask)?n["opts"].onBeforeMask.call(lt,t,n["opts"]):t);e(this).triggerHandler("setvalue.inputmask")}else{o.call(this,t)}}})}}else if(document.__lookupGetter__&&t.__lookupGetter__("value")){if(!t._valueGet){var i=t.__lookupGetter__("value");var o=t.__lookupSetter__("value");t._valueGet=function(){return s?i.call(this).split("").reverse().join(""):i.call(this)};t._valueSet=function(e){o.call(this,s?e.split("").reverse().join(""):e)};t.__defineGetter__("value",function(){var t=e(this),n=e(this).data("_inputmask");if(n){return n["opts"].autoUnmask?t.inputmask("unmaskedvalue"):i.call(this)!=L().join("")?i.call(this):""}else return i.call(this)});t.__defineSetter__("value",function(t){var n=e(this).data("_inputmask");if(n){o.call(this,e.isFunction(n["opts"].onBeforeMask)?n["opts"].onBeforeMask.call(lt,t,n["opts"]):t);e(this).triggerHandler("setvalue.inputmask")}else{o.call(this,t)}})}}else{if(!t._valueGet){t._valueGet=function(){return s?this.value.split("").reverse().join(""):this.value};t._valueSet=function(e){this.value=s?e.split("").reverse().join(""):e}}n(t.type)}}function Z(e,t,n){if(r.numericInput||s){if(t==r.keyCode.BACKSPACE)t=r.keyCode.DELETE;else if(t==r.keyCode.DELETE)t=r.keyCode.BACKSPACE;if(s){var i=n.end;n.end=n.begin;n.begin=i}}if(t==r.keyCode.BACKSPACE&&n.end-n.begin<=1)n.begin=B(n.begin);else if(t==r.keyCode.DELETE&&n.begin==n.end)n.end++;x(n.begin,n.end);var o=E(n.begin);if(o<n.begin){b()["p"]=H(o)}else{b()["p"]=n.begin}}function et(e,t,n){if(t&&t["refreshFromBuffer"]){var r=t["refreshFromBuffer"];O(r===true?r:r["start"],r["end"]);w(true);if(n!=undefined){F(e,A());X(e,t.caret||n.begin,t.caret||n.end)}}}function tt(t){d=false;var n=this,i=e(n),u=t.keyCode,a=X(n);if(u==r.keyCode.BACKSPACE||u==r.keyCode.DELETE||o&&u==127||t.ctrlKey&&u==88){t.preventDefault();if(u==88)h=A().join("");Z(n,u,a);F(n,A(),b()["p"]);if(n._valueGet()==L().join(""))i.trigger("cleared");if(r.showTooltip){i.prop("title",b()["mask"])}}else if(u==r.keyCode.END||u==r.keyCode.PAGE_DOWN){setTimeout(function(){var e=H(E());if(!r.insertMode&&e==P()&&!t.shiftKey)e--;X(n,t.shiftKey?a.begin:e,e)},0)}else if(u==r.keyCode.HOME&&!t.shiftKey||u==r.keyCode.PAGE_UP){X(n,0,t.shiftKey?a.begin:0)}else if(u==r.keyCode.ESCAPE||u==90&&t.ctrlKey){q(n,true,false,h.split(""));i.click()}else if(u==r.keyCode.INSERT&&!(t.shiftKey||t.ctrlKey)){r.insertMode=!r.insertMode;X(n,!r.insertMode&&a.begin==P()?a.begin-1:a.begin)}else if(r.insertMode==false&&!t.shiftKey){if(u==r.keyCode.RIGHT){setTimeout(function(){var e=X(n);X(n,e.begin)},0)}else if(u==r.keyCode.LEFT){setTimeout(function(){var e=X(n);X(n,s?e.begin+1:e.begin-1)},0)}}var f=X(n);var l=r.onKeyDown.call(this,t,A(),f.begin,r);et(n,l,f);m=e.inArray(u,r.ignorables)!=-1}function nt(t,n,i,o,u,a){if(i==undefined&&d)return false;d=true;var f=this,l=e(f);t=t||window.event;var i=n?i:t.which||t.charCode||t.keyCode;if(n!==true&&!(t.ctrlKey&&t.altKey)&&(t.ctrlKey||t.metaKey||m)){return true}else{if(i){if(n!==true&&i==46&&t.shiftKey==false&&r.radixPoint==",")i=44;var c,h,p=String.fromCharCode(i);if(n){var g=u?a:E()+1;c={begin:g,end:g}}else{c=X(f)}var y=Q(c.begin,c.end);if(y){b()["undoPositions"]=e.extend(true,{},b()["validPositions"]);Z(f,r.keyCode.DELETE,c);if(!r.insertMode){r.insertMode=!r.insertMode;S(c.begin,u);r.insertMode=!r.insertMode}y=!r.multi}b()["writeOutBuffer"]=true;var x=s&&!y?c.end:c.begin;var T=_(x,p,u);if(T!==false){if(T!==true){x=T.pos!=undefined?T.pos:x;p=T.c!=undefined?T.c:p}w(true);if(T.caret!=undefined)h=T.caret;else{var N=b()["validPositions"];if(N[x+1]!=undefined&&k(x+1,N[x].locator.slice(),x).length>1)h=x+1;else h=H(x)}b()["p"]=h}if(o!==false){var C=this;setTimeout(function(){r.onKeyValidation.call(C,T,r)},0);if(b()["writeOutBuffer"]&&T!==false){var L=A();F(f,L,n?undefined:r.numericInput?B(h):h);if(n!==true){setTimeout(function(){if(K(L)===true)l.trigger("complete");v=true;l.trigger("input")},0)}}else if(y){b()["buffer"]=undefined;b()["validPositions"]=b()["undoPositions"]}}else if(y){b()["buffer"]=undefined;b()["validPositions"]=b()["undoPositions"]}if(r.showTooltip){l.prop("title",b()["mask"])}if(t&&n!=true){t.preventDefault?t.preventDefault():t.returnValue=false;var O=X(f);var M=r.onKeyPress.call(this,t,A(),O.begin,r);et(f,M,O)}var D;for(var P in b().validPositions){D+=" "+P}}}}function rt(t){var n=e(this),i=this,s=t.keyCode,o=A();var u=X(i);var a=r.onKeyUp.call(this,t,o,u.begin,r);et(i,a,u);if(s==r.keyCode.TAB&&r.showMaskOnFocus){if(n.hasClass("focus-inputmask")&&i._valueGet().length==0){w();o=A();F(i,o);X(i,0);h=A().join("")}else{F(i,o);X(i,W(0),W(P()))}}}function it(t){if(v===true&&t.type=="input"){v=false;return true}var n=this,i=e(n),s=n._valueGet();if(t.type=="propertychange"&&n._valueGet().length<=P()){return true}else if(t.type=="paste"){if(window.clipboardData&&window.clipboardData.getData){s=window.clipboardData.getData("Text")}else if(t.originalEvent&&t.originalEvent.clipboardData&&t.originalEvent.clipboardData.getData){s=t.originalEvent.clipboardData.getData("text/plain")}}var o=e.isFunction(r.onBeforePaste)?r.onBeforePaste.call(n,s,r):s;q(n,true,false,o.split(""),true);i.click();if(K(A())===true)i.trigger("complete");return false}function st(e){if(v===true&&e.type=="input"){v=false;return true}var t=this;var n=X(t),i=t._valueGet();i=i.replace(new RegExp("("+R(L().join(""))+")*"),"");if(n.begin>i.length){X(t,i.length);n=X(t)}if(A().length-i.length==1&&i.charAt(n.begin)!=A()[n.begin]&&i.charAt(n.begin+1)!=A()[n.begin]&&!D(n.begin)){e.keyCode=r.keyCode.BACKSPACE;tt.call(t,e)}e.preventDefault()}function ot(t){p=e(t);if(p.is(":input")&&p.attr("type")!="number"){p.data("_inputmask",{maskset:n,opts:r,isRTL:false});if(r.showTooltip){p.prop("title",b()["mask"])}Y(t);if(t.dir=="rtl"||r.rightAlign)p.css("text-align","right");if(t.dir=="rtl"||r.numericInput){t.dir="ltr";p.removeAttr("dir");var o=p.data("_inputmask");o["isRTL"]=true;p.data("_inputmask",o);s=true}p.unbind(".inputmask");p.removeClass("focus-inputmask");p.closest("form").bind("submit",function(){if(h!=A().join("")){p.change()}if(r.autoUnmask&&r.removeMaskOnSubmit){p.inputmask("remove")}}).bind("reset",function(){setTimeout(function(){p.trigger("setvalue")},0)});p.bind("mouseenter.inputmask",function(){var t=e(this),n=this;if(!t.hasClass("focus-inputmask")&&r.showMaskOnHover){if(n._valueGet()!=A().join("")){F(n,A())}}}).bind("blur.inputmask",function(){var t=e(this),n=this;if(t.data("_inputmask")){var i=n._valueGet(),s=A();t.removeClass("focus-inputmask");if(h!=A().join("")){t.change()}if(r.clearMaskOnLostFocus&&i!=""){if(i==L().join(""))n._valueSet("");else{J(n)}}if(K(s)===false){t.trigger("incomplete");if(r.clearIncomplete){w();if(r.clearMaskOnLostFocus)n._valueSet("");else{s=L().slice();F(n,s)}}}}}).bind("focus.inputmask",function(){var t=e(this),n=this,i=n._valueGet();if(r.showMaskOnFocus&&!t.hasClass("focus-inputmask")&&(!r.showMaskOnHover||r.showMaskOnHover&&i=="")){if(n._valueGet()!=A().join("")){F(n,A(),H(E()))}}t.addClass("focus-inputmask");h=A().join("")}).bind("mouseleave.inputmask",function(){var t=e(this),n=this;if(r.clearMaskOnLostFocus){if(!t.hasClass("focus-inputmask")&&n._valueGet()!=t.attr("placeholder")){if(n._valueGet()==L().join("")||n._valueGet()=="")n._valueSet("");else{J(n)}}}}).bind("click.inputmask",function(){var t=this;if(e(t).is(":focus")){setTimeout(function(){var e=X(t);if(e.begin==e.end){var n=s?W(e.begin):e.begin,r=E(n),i=H(r);if(n<i){if(D(n))X(t,n);else X(t,H(n))}else X(t,i)}},0)}}).bind("dblclick.inputmask",function(){var e=this;setTimeout(function(){X(e,0,H(E()))},0)}).bind(c+".inputmask dragdrop.inputmask drop.inputmask",it).bind("setvalue.inputmask",function(){var e=this;q(e,true);h=A().join("")}).bind("complete.inputmask",r.oncomplete).bind("incomplete.inputmask",r.onincomplete).bind("cleared.inputmask",r.oncleared);p.bind("keydown.inputmask",tt).bind("keypress.inputmask",nt).bind("keyup.inputmask",rt);if(u||f||a||l){if(c=="input"){p.unbind(c+".inputmask")}p.bind("input.inputmask",st)}if(i)p.bind("input.inputmask",it);var d=e.isFunction(r.onBeforeMask)?r.onBeforeMask.call(t,t._valueGet(),r):t._valueGet();q(t,true,false,d.split(""),true);h=A().join("");var v;try{v=document.activeElement}catch(m){}if(K(A())===false){if(r.clearIncomplete)w()}if(r.clearMaskOnLostFocus){if(A().join("")==L().join("")){t._valueSet("")}else{J(t)}}else{F(t,A())}if(v===t){p.addClass("focus-inputmask");X(t,H(E()))}G(t)}}var s=false,h,p,d=false,v=false,m=false,g;if(t!=undefined){switch(t["action"]){case"isComplete":p=e(t["el"]);n=p.data("_inputmask")["maskset"];r=p.data("_inputmask")["opts"];return K(t["buffer"]);case"unmaskedvalue":p=t["$input"];n=p.data("_inputmask")["maskset"];r=p.data("_inputmask")["opts"];s=t["$input"].data("_inputmask")["isRTL"];return z(t["$input"]);case"mask":h=A().join("");ot(t["el"]);break;case"format":p=e({});p.data("_inputmask",{maskset:n,opts:r,isRTL:r.numericInput});if(r.numericInput){s=true}var ut=t["value"].split("");q(p,false,false,s?ut.reverse():ut,true);return s?A().reverse().join(""):A().join("");case"isValid":p=e({});p.data("_inputmask",{maskset:n,opts:r,isRTL:r.numericInput});if(r.numericInput){s=true}var ut=t["value"].split("");q(p,false,true,s?ut.reverse():ut);var at=A();var ft=V();at.length=ft;return K(at)&&t["value"]==at.join("");case"getemptymask":p=e(t["el"]);n=p.data("_inputmask")["maskset"];r=p.data("_inputmask")["opts"];return L();case"remove":var lt=t["el"];p=e(lt);n=p.data("_inputmask")["maskset"];r=p.data("_inputmask")["opts"];lt._valueSet(z(p));p.unbind(".inputmask");p.removeClass("focus-inputmask");p.removeData("_inputmask");var ct;if(Object.getOwnPropertyDescriptor)ct=Object.getOwnPropertyDescriptor(lt,"value");if(ct&&ct.get){if(lt._valueGet){Object.defineProperty(lt,"value",{get:lt._valueGet,set:lt._valueSet})}}else if(document.__lookupGetter__&&lt.__lookupGetter__("value")){if(lt._valueGet){lt.__defineGetter__("value",lt._valueGet);lt.__defineSetter__("value",lt._valueSet)}}try{delete lt._valueGet;delete lt._valueSet}catch(ht){lt._valueGet=undefined;lt._valueSet=undefined}break}}}e.inputmask={defaults:{placeholder:"_",optionalmarker:{start:"[",end:"]"},quantifiermarker:{start:"{",end:"}"},groupmarker:{start:"(",end:")"},alternatormarker:"|",escapeChar:"\\",mask:null,oncomplete:e.noop,onincomplete:e.noop,oncleared:e.noop,repeat:0,greedy:true,autoUnmask:false,removeMaskOnSubmit:true,clearMaskOnLostFocus:true,insertMode:true,clearIncomplete:false,aliases:{},alias:null,onKeyUp:e.noop,onKeyPress:e.noop,onKeyDown:e.noop,onBeforeMask:undefined,onBeforePaste:undefined,onUnMask:undefined,showMaskOnFocus:true,showMaskOnHover:true,onKeyValidation:e.noop,skipOptionalPartCharacter:" ",showTooltip:false,numericInput:false,rightAlign:false,radixPoint:"",nojumps:false,nojumpsThreshold:0,definitions:{9:{validator:"[0-9]",cardinality:1,definitionSymbol:"*"},a:{validator:"[A-Za-zА-яЁё]",cardinality:1,definitionSymbol:"*"},"*":{validator:"[A-Za-zА-яЁё0-9]",cardinality:1}},keyCode:{ALT:18,BACKSPACE:8,CAPS_LOCK:20,COMMA:188,COMMAND:91,COMMAND_LEFT:91,COMMAND_RIGHT:93,CONTROL:17,DELETE:46,DOWN:40,END:35,ENTER:13,ESCAPE:27,HOME:36,INSERT:45,LEFT:37,MENU:93,NUMPAD_ADD:107,NUMPAD_DECIMAL:110,NUMPAD_DIVIDE:111,NUMPAD_ENTER:108,NUMPAD_MULTIPLY:106,NUMPAD_SUBTRACT:109,PAGE_DOWN:34,PAGE_UP:33,PERIOD:190,RIGHT:39,SHIFT:16,SPACE:32,TAB:9,UP:38,WINDOWS:91},ignorables:[8,9,13,19,27,33,34,35,36,37,38,39,40,45,46,93,112,113,114,115,116,117,118,119,120,121,122,123],isComplete:undefined},masksCache:{},escapeRegex:function(e){var t=["/",".","*","+","?","|","(",")","[","]","{","}","\\"];return e.replace(new RegExp("(\\"+t.join("|\\")+")","gim"),"\\$1")},format:function(t,i){var s=e.extend(true,{},e.inputmask.defaults,i);n(s.alias,i,s);return h({action:"format",value:t},r(s),s)},isValid:function(t,i){var s=e.extend(true,{},e.inputmask.defaults,i);n(s.alias,i,s);return h({action:"isValid",value:t},r(s),s)}};e.fn.inputmask=function(t,i,s,o,u){function a(t,n){var r=e(t);for(var i in n){var s=r.data("inputmask-"+i.toLowerCase());if(s!=undefined)n[i]=s}return n}s=s||h;o=o||"_inputmask";var f=e.extend(true,{},e.inputmask.defaults,i),l;if(typeof t==="string"){switch(t){case"mask":n(f.alias,i,f);l=r(f,s!==h);if(l.length==0){return this}return this.each(function(){s({action:"mask",el:this},e.extend(true,{},l),a(this,f))});case"unmaskedvalue":var c=e(this);if(c.data(o)){return s({action:"unmaskedvalue",$input:c})}else return c.val();case"remove":return this.each(function(){var t=e(this);if(t.data(o)){s({action:"remove",el:this})}});case"getemptymask":if(this.data(o)){return s({action:"getemptymask",el:this})}else return"";case"hasMaskedValue":return this.data(o)?!this.data(o)["opts"].autoUnmask:false;case"isComplete":if(this.data(o)){return s({action:"isComplete",buffer:this[0]._valueGet().split(""),el:this})}else return true;case"getmetadata":if(this.data(o)){l=this.data(o)["maskset"];return l["metadata"]}else return undefined;case"_detectScope":n(f.alias,i,f);if(u!=undefined&&!n(u,i,f)&&e.inArray(u,["mask","unmaskedvalue","remove","getemptymask","hasMaskedValue","isComplete","getmetadata","_detectScope"])==-1){f.mask=u}if(e.isFunction(f.mask)){f.mask=f.mask.call(this,f)}return e.isArray(f.mask);default:n(f.alias,i,f);if(!n(t,i,f)){f.mask=t}l=r(f,s!==h);if(l==undefined){return this}return this.each(function(){s({action:"mask",el:this},e.extend(true,{},l),a(this,f))})}}else if(typeof t=="object"){f=e.extend(true,{},e.inputmask.defaults,t);n(f.alias,t,f);l=r(f,s!==h);if(l==undefined){return this}return this.each(function(){s({action:"mask",el:this},e.extend(true,{},l),a(this,f))})}else if(t==undefined){return this.each(function(){var t=e(this).attr("data-inputmask");if(t&&t!=""){try{t=t.replace(new RegExp("'","g"),'"');var r=e.parseJSON("{"+t+"}");e.extend(true,r,i);f=e.extend(true,{},e.inputmask.defaults,r);n(f.alias,r,f);f.alias=undefined;e(this).inputmask("mask",f,s)}catch(o){}}})}}}})(jQuery);


/*
    Masked Input plugin for jQuery
    Copyright (c) 2007-2013 Josh Bush (digitalbush.com)
    Licensed under the MIT license (http://digitalbush.com/projects/masked-input-plugin/#license)
    Version: 1.3.1

    // Used when element format = 'phone' // TODO: break out into conditional load.
*/
    (function(e){function t(){var e=document.createElement("input"),t="onpaste";return e.setAttribute(t,""),"function"==typeof e[t]?"paste":"input"}var n,a=t()+".mask",r=navigator.userAgent,i=/iphone/i.test(r),o=/android/i.test(r);e.mask={definitions:{9:"[0-9]",a:"[A-Za-z]","*":"[A-Za-z0-9]"},dataName:"rawMaskFn",placeholder:"_"},e.fn.extend({caret:function(e,t){var n;if(0!==this.length&&!this.is(":hidden"))return"number"==typeof e?(t="number"==typeof t?t:e,this.each(function(){this.setSelectionRange?this.setSelectionRange(e,t):this.createTextRange&&(n=this.createTextRange(),n.collapse(!0),n.moveEnd("character",t),n.moveStart("character",e),n.select())})):(this[0].setSelectionRange?(e=this[0].selectionStart,t=this[0].selectionEnd):document.selection&&document.selection.createRange&&(n=document.selection.createRange(),e=0-n.duplicate().moveStart("character",-1e5),t=e+n.text.length),{begin:e,end:t})},unmask:function(){return this.trigger("unmask")},mask:function(t,r){var c,l,s,u,f,h;return!t&&this.length>0?(c=e(this[0]),c.data(e.mask.dataName)()):(r=e.extend({placeholder:e.mask.placeholder,completed:null},r),l=e.mask.definitions,s=[],u=h=t.length,f=null,e.each(t.split(""),function(e,t){"?"==t?(h--,u=e):l[t]?(s.push(RegExp(l[t])),null===f&&(f=s.length-1)):s.push(null)}),this.trigger("unmask").each(function(){function c(e){for(;h>++e&&!s[e];);return e}function d(e){for(;--e>=0&&!s[e];);return e}function m(e,t){var n,a;if(!(0>e)){for(n=e,a=c(t);h>n;n++)if(s[n]){if(!(h>a&&s[n].test(R[a])))break;R[n]=R[a],R[a]=r.placeholder,a=c(a)}b(),x.caret(Math.max(f,e))}}function p(e){var t,n,a,i;for(t=e,n=r.placeholder;h>t;t++)if(s[t]){if(a=c(t),i=R[t],R[t]=n,!(h>a&&s[a].test(i)))break;n=i}}function g(e){var t,n,a,r=e.which;8===r||46===r||i&&127===r?(t=x.caret(),n=t.begin,a=t.end,0===a-n&&(n=46!==r?d(n):a=c(n-1),a=46===r?c(a):a),k(n,a),m(n,a-1),e.preventDefault()):27==r&&(x.val(S),x.caret(0,y()),e.preventDefault())}function v(t){var n,a,i,l=t.which,u=x.caret();t.ctrlKey||t.altKey||t.metaKey||32>l||l&&(0!==u.end-u.begin&&(k(u.begin,u.end),m(u.begin,u.end-1)),n=c(u.begin-1),h>n&&(a=String.fromCharCode(l),s[n].test(a)&&(p(n),R[n]=a,b(),i=c(n),o?setTimeout(e.proxy(e.fn.caret,x,i),0):x.caret(i),r.completed&&i>=h&&r.completed.call(x))),t.preventDefault())}function k(e,t){var n;for(n=e;t>n&&h>n;n++)s[n]&&(R[n]=r.placeholder)}function b(){x.val(R.join(""))}function y(e){var t,n,a=x.val(),i=-1;for(t=0,pos=0;h>t;t++)if(s[t]){for(R[t]=r.placeholder;pos++<a.length;)if(n=a.charAt(pos-1),s[t].test(n)){R[t]=n,i=t;break}if(pos>a.length)break}else R[t]===a.charAt(pos)&&t!==u&&(pos++,i=t);return e?b():u>i+1?(x.val(""),k(0,h)):(b(),x.val(x.val().substring(0,i+1))),u?t:f}var x=e(this),R=e.map(t.split(""),function(e){return"?"!=e?l[e]?r.placeholder:e:void 0}),S=x.val();x.data(e.mask.dataName,function(){return e.map(R,function(e,t){return s[t]&&e!=r.placeholder?e:null}).join("")}),x.attr("readonly")||x.one("unmask",function(){x.unbind(".mask").removeData(e.mask.dataName)}).bind("focus.mask",function(){clearTimeout(n);var e;S=x.val(),e=y(),n=setTimeout(function(){b(),e==t.length?x.caret(0,e):x.caret(e)},10)}).bind("blur.mask",function(){y(),x.val()!=S&&x.change()}).bind("keydown.mask",g).bind("keypress.mask",v).bind(a,function(){setTimeout(function(){var e=y(!0);x.caret(e),r.completed&&e==x.val().length&&r.completed.call(x)},0)}),y()}))}})})(jQuery);

/*
    * maskMoney plugin for jQuery
    * http://plentz.github.com/jquery-maskmoney/
    * version: 2.1.2
    * Licensed under the MIT license

    // Used when element format = 'money' // TODO: break out into conditional load.
*/
    (function(e){if(!e.browser){e.browser={};e.browser.mozilla=/mozilla/.test(navigator.userAgent.toLowerCase())&&!/webkit/.test(navigator.userAgent.toLowerCase());e.browser.webkit=/webkit/.test(navigator.userAgent.toLowerCase());e.browser.opera=/opera/.test(navigator.userAgent.toLowerCase());e.browser.msie=/msie/.test(navigator.userAgent.toLowerCase())}var t={destroy:function(){var t=e(this);t.unbind(".maskMoney");if(e.browser.msie){this.onpaste=null}return this},mask:function(){return this.trigger("mask")},init:function(t){t=e.extend({symbol:"",symbolStay:false,thousands:",",decimal:".",precision:2,defaultZero:true,allowZero:false,allowNegative:false},t);return this.each(function(){function i(){r=true}function s(){r=false}function o(t){t=t||window.event;var o=t.which||t.charCode||t.keyCode;if(o==undefined)return false;if(o<48||o>57){if(o==45){i();n.val(g(n));return false}else if(o==43){i();n.val(n.val().replace("-",""));return false}else if(o==13||o==9){if(r){s();e(this).change()}return true}else if(e.browser.mozilla&&(o==37||o==39)&&t.charCode==0){return true}else{c(t);return true}}else if(u(n)){return false}else{c(t);var a=String.fromCharCode(o);var f=n.get(0);var l=b(f);var p=l.start;var d=l.end;f.value=f.value.substring(0,p)+a+f.value.substring(d,f.value.length);h(f,p+1);i();return false}}function u(e){var t=e.val().length>=e.attr("maxlength")&&e.attr("maxlength")>=0;var n=b(e.get(0));var r=n.start;var i=n.end;var s=n.start!=n.end&&e.val().substring(r,i).match(/\d/)?true:false;return t&&!s}function a(t){t=t||window.event;var o=t.which||t.charCode||t.keyCode;if(o==undefined)return false;var u=n.get(0);var a=b(u);var f=a.start;var l=a.end;if(o==8){c(t);if(f==l){u.value=u.value.substring(0,f-1)+u.value.substring(l,u.value.length);f=f-1}else{u.value=u.value.substring(0,f)+u.value.substring(l,u.value.length)}h(u,f);i();return false}else if(o==9){if(r){e(this).change();s()}return true}else if(o==46||o==63272){c(t);if(u.selectionStart==u.selectionEnd){u.value=u.value.substring(0,f)+u.value.substring(l+1,u.value.length)}else{u.value=u.value.substring(0,f)+u.value.substring(l,u.value.length)}h(u,f);i();return false}else{return true}}function f(e){var r=v();if(n.val()==r){n.val("")}else if(n.val()==""&&t.defaultZero){n.val(m(r))}else{n.val(m(n.val()))}if(this.createTextRange){var i=this.createTextRange();i.collapse(false);i.select()}}function l(r){if(e.browser.msie){o(r)}if(n.val()==""||n.val()==m(v())||n.val()==t.symbol){if(!t.allowZero){n.val("")}else if(!t.symbolStay){n.val(v())}else{n.val(m(v()))}}else{if(!t.symbolStay){n.val(n.val().replace(t.symbol,""))}else if(t.symbolStay&&n.val()==t.symbol){n.val(m(v()))}}}function c(e){if(e.preventDefault){e.preventDefault()}else{e.returnValue=false}}function h(e,t){var r=n.val().length;n.val(d(e.value));var i=n.val().length;t=t-(r-i);y(n,t)}function p(){var e=n.val();n.val(d(e))}function d(e){e=e.replace(t.symbol,"");var n="0123456789";var r=e.length;var i="",s="",o="";if(r!=0&&e.charAt(0)=="-"){e=e.replace("-","");if(t.allowNegative){o="-"}}if(r==0){if(!t.defaultZero)return s;s="0.00"}for(var u=0;u<r;u++){if(e.charAt(u)!="0"&&e.charAt(u)!=t.decimal)break}for(;u<r;u++){if(n.indexOf(e.charAt(u))!=-1)i+=e.charAt(u)}var a=parseFloat(i);a=isNaN(a)?0:a/Math.pow(10,t.precision);s=a.toFixed(t.precision);u=t.precision==0?0:1;var f,l=(s=s.split("."))[u].substr(0,t.precision);for(f=(s=s[0]).length;(f-=3)>=1;){s=s.substr(0,f)+t.thousands+s.substr(f)}return t.precision>0?m(o+s+t.decimal+l+Array(t.precision+1-l.length).join(0)):m(o+s)}function v(){var e=parseFloat("0")/Math.pow(10,t.precision);return e.toFixed(t.precision).replace(new RegExp("\\.","g"),t.decimal)}function m(e){if(t.symbol!=""){var n="";if(e.length!=0&&e.charAt(0)=="-"){e=e.replace("-","");n="-"}if(e.substr(0,t.symbol.length)!=t.symbol){e=n+t.symbol+e}}return e}function g(e){var n=e.val();if(t.allowNegative){if(n!=""&&n.charAt(0)=="-"){return n.replace("-","")}else{return"-"+n}}else{return n}}function y(t,n){e(t).each(function(e,t){if(t.setSelectionRange){t.focus();t.setSelectionRange(n,n)}else if(t.createTextRange){var r=t.createTextRange();r.collapse(true);r.moveEnd("character",n);r.moveStart("character",n);r.select()}});return this}function b(e){var t=0,n=0,r,i,s,o,u;if(typeof e.selectionStart=="number"&&typeof e.selectionEnd=="number"){t=e.selectionStart;n=e.selectionEnd}else{i=document.selection.createRange();if(i&&i.parentElement()==e){o=e.value.length;r=e.value.replace(/\r\n/g,"\n");s=e.createTextRange();s.moveToBookmark(i.getBookmark());u=e.createTextRange();u.collapse(false);if(s.compareEndPoints("StartToEnd",u)>-1){t=n=o}else{t=-s.moveStart("character",-o);t+=r.slice(0,t).split("\n").length-1;if(s.compareEndPoints("EndToEnd",u)>-1){n=o}else{n=-s.moveEnd("character",-o);n+=r.slice(0,n).split("\n").length-1}}}}return{start:t,end:n}}var n=e(this);var r=false;n.unbind(".maskMoney");n.bind("keypress.maskMoney",o);n.bind("keydown.maskMoney",a);n.bind("blur.maskMoney",l);n.bind("focus.maskMoney",f);n.bind("mask.maskMoney",p)})}};e.fn.maskMoney=function(n){if(t[n]){return t[n].apply(this,Array.prototype.slice.call(arguments,1))}else if(typeof n==="object"||!n){return t.init.apply(this,arguments)}else{e.error("Method "+n+" does not exist on jQuery.maskMoney")}}})(window.jQuery||window.Zepto)

