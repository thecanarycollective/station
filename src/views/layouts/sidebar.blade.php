<ul class="nav nav-list nav-list-vivid" id="sidebar">

	<li id="station-branding">
		<a href="/">{{ $app_data['name'] }}</a>
	</li>

	<li class="nav-user-control">
        <a href="/{{ $app_data['root_uri_segment'] }}/panel/my_account/update/{{ $user_data['id'] }}" class="pull-left">
          <img class="gravatar" src="https://www.gravatar.com/avatar/{{ $user_data['gravatar_hash'] }}?s=30&d=identicon">&nbsp; 
          {{ $user_data['name'] }}
        </a>
        <a href="/{{ $app_data['root_uri_segment'] }}/logout/" class="pull-right"><span class="glyphicon glyphicon-log-out"></span></a>
    </li>

	@foreach($sidenav_data as $side_data)
		@if (isset($side_data['is_header']) && $side_data['is_header']) 
			<li class="nav-header">
				{{ $side_data['label'] }}

				@if ($side_data['icon'])
					<span class="pull-right {{ $side_data['icon'] }}"></span>
				@endif
			</li>
		@else 
			<li class="{{ isset($curr_panel) && $curr_panel == $side_data['panel'] ? 'active' : '' }}">
				<a href="{{ $side_data['uri'] }}">
					{{ $side_data['label'] }}

					@if ($side_data['icon'])
						<span class="pull-right {{ $side_data['icon'] }}"></span>
					@endif

					@if ($side_data['badge'] || $side_data['badge'] != '')
						<span class="badge pull-right">{{ $side_data['badge'] }}</span>
					@endif
				</a>
			</li>
		@endif
	@endforeach
</ul>