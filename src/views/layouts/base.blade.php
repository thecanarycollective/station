<!DOCTYPE html>
<html lang="en">
  <head>
    
    <title>{{ $app_data['name'].' | '.$page_title }}</title>

    <meta name="viewport" content="width=device-width, initial-scale=1.0">

    <!-- Bootstrap -->
    @section('head')

    @if (isset($assets['css']) and count($assets['css']) > 0)
      @foreach ($assets['css'] as $css_file)
        <link href="{{ substr($css_file, 0, 1) == '/' || substr($css_file, 0, 4) == 'http' ? $css_file : '/packages/canary/station/css/'.$css_file }}" rel="stylesheet">
      @endforeach
    @endif

    <link href="/packages/canary/station/Flat-UI-Pro-1.2.2/bootstrap/css/bootstrap.css" rel="stylesheet">
    <link href="/packages/canary/station/Flat-UI-Pro-1.2.2/css/flat-ui.css" rel="stylesheet">
    <link href="/packages/canary/station/css/base.css?v10" rel="stylesheet">
    {{ $app_data['css_override_file'] != '' ? '<link href="'.$app_data['css_override_file'].'" rel="stylesheet">' : '' }}

    <script src="/packages/canary/station/js/jquery-1.11.2.min.js"></script>
    <script src="/packages/canary/station/js/radiocheck.js"></script>
    <script src="/packages/canary/station/Flat-UI-Pro-1.2.2/js/bootstrap.min.js"></script>
    <script src="/packages/canary/station/js/jquery-ui-1.10.3.custom.min.js"></script>
    <script src="/packages/canary/station/Flat-UI-Pro-1.2.2/js/jquery.ui.touch-punch.min.js"></script>
    <script src="/packages/canary/station/Flat-UI-Pro-1.2.2/js/bootstrap.min.js"></script>
    <script src="/packages/canary/station/Flat-UI-Pro-1.2.2/js/bootstrap-select.js"></script>
    <script src="/packages/canary/station/Flat-UI-Pro-1.2.2/js/bootstrap-switch.js"></script>
    <script src="/packages/canary/station/Flat-UI-Pro-1.2.2/js/flatui-checkbox.js"></script>
    <script src="/packages/canary/station/Flat-UI-Pro-1.2.2/js/flatui-radio.js"></script>
    <script src="/packages/canary/station/Flat-UI-Pro-1.2.2/js/jquery.tagsinput.js"></script>
    <script src="/packages/canary/station/Flat-UI-Pro-1.2.2/js/jquery.placeholder.js"></script>
    <script src="/packages/canary/station/Flat-UI-Pro-1.2.2/js/application.js"></script>
    <script src="/packages/canary/station/js/station_application.js?v2"></script>

    <!-- HTML5 Shim and Respond.js IE8 support of HTML5 elements and media queries -->
    <!-- WARNING: Respond.js doesn't work if you view the page via file:// -->
    <!--[if lt IE 9]>
      <script src="https://oss.maxcdn.com/libs/html5shiv/3.7.0/html5shiv.js"></script>
      <script src="https://oss.maxcdn.com/libs/respond.js/1.3.0/respond.min.js"></script>
    <![endif]-->

    @if (isset($assets['js']) and count($assets['js']) > 0)
      @foreach ($assets['js'] as $js_file)
        <script src="{{ substr($js_file, 0, 1) == '/' || substr($js_file, 0, 4) == 'http' ? $js_file : '/packages/canary/station/js/'.$js_file }}"></script>
      @endforeach
    @endif

    <script type="text/javascript">
      var base_uri    = '{{ $base_uri }}';
      var curr_panel  = '{{ $curr_panel }}';
      var curr_subpanel  = '{{ isset($curr_subpanel) ? $curr_subpanel : '' }}';
      var curr_method = '{{ $curr_method }}';
      var curr_id = '{{ $curr_id }}';
    </script>

  @show

  </head>
  <body class="panel-{{ $curr_panel }}">
    
    @if(Auth::check())

      @include('station::layouts.navbar')
    
      <div class="container">
        <div class="row">
          <div id="sidebar-container" class="col-sm-2">
            @include('station::layouts.sidebar')
          </div>
          <div id="content-container" class="col-sm-10">
            <div class="row">
              <div class="col-sm-12">
                {{-- for showing flashes via ajax responses --}}
                <div class="empty-flash-holder" style="display: none;"></div>
                @if (isset($app_data['html_prepend_content_file']) && $app_data['html_prepend_content_file'] != '')
                  @include($app_data['html_prepend_content_file'])
                @endif

                @include('station::layouts.header')
                
                @yield('content')
              </div>
            </div>
            
          </div>
        </div>
      </div>

    @else

      <div class="container">
        <div class="row row-header">
          <div class="col-md-6 col-md-offset-3">
            @include('station::layouts.header')
            @yield('content')
          </div>
        </div>
      </div>

      <div class="text-center">
          Have an Account? &nbsp; <a href="{{ '/'.$app_data['root_uri_segment'].'/login' }}">Login Here</a>
      </div>

    @endif

    @if (isset($app_data['html_append_file']) && $app_data['html_append_file'] != '')
      @include($app_data['html_append_file'])
    @endif
    
  </body>
</html>
