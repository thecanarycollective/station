@extends('station::layouts.base')

@section('content')

	<div id="list-for-{{ $curr_panel }}" class="station-list-wrap" data-panel-name="{{ $curr_panel }}">

		@if (count($data['data']) > 0 || $is_trying_to_filter)

			<div class="clearfix">
				<div class="pull-left">
					<h5>
						{{ $layout_title }} &nbsp; 
						<small>
							{{ count($data['data']) > 1 ? count($data['data']) : '' }}
							{{ $raw_count > count($data['data']) ? ' of '.$raw_count : '' }}
							
							{{ ($is_reorderable || $is_nestable) && count($data['data']) > 1 ? 
								'&nbsp;&nbsp;&nbsp;&nbsp;<a class="btn btn-xs btn-default drag-drop-notice">Drag and Drop to Reorder</a>' : '' }}
							
							@if ($is_nestable && count($data['data']) > 1)
								<a class="btn btn-xs btn-info nestables-collapse-all"><span class="fui-list"></span>&nbsp;Collapse All</a>
								<a class="btn btn-xs btn-info nestables-expand-all"><span class="fui-list-numbered"></span>&nbsp;Expand All</a>
							@endif
						</small>
					</h5>
				</div>
				<div class="pull-right station-list-head-right">

					{{-- We need a create new button! --}}
					@if ($user_can_create)
						<a href="{{ $panel_data['relative_uri'].'/create' }}" class="btn btn-lg btn-success list-new station-creator">
							<span class="fui-plus"></span>&nbsp;
							Create a New {{ $single_item_name }}
						</a>
					@endif

					{{-- show search bar when we have enough records to search --}}
					@if ($raw_count > 12)
						<div class="form-group station-quick-find-wrap">
				          	<div class="input-group">		            	              
				              <input type="text" class="form-control station-panel-quick-finder" placeholder="Search {{ str_plural($single_item_name) }}" id="station-quick-find">
				              <span class="input-group-btn">
					            	<button type="submit" class="btn"><span class="fui-search"></span></button>
				            	</span>
				            </div>
			        	</div>	
					@endif
				</div>
			</div>

			{{-- First we build the list header--}}
			{{ $list_outer_wrap[0] }}

				@if (!$is_reorderable && !$is_nestable)
					<thead>
						<tr>
							@if ($user_can_bulk_delete)
								<th class="bulk-check-all">
									<label class="checkbox primary"><input type="checkbox" value="" id="checkbox1" data-toggle="checkbox"></label>
								</th>
							@endif

							@if ($user_can_update)
								<th>{{-- For our update/edit buttons column --}}</th>
							@endif

							@foreach($data['config']['elements'] as $elem_name => $elem_data)
								<th class="element-col-head-{{{ $elem_name }}}">
									<?php
										$filter_data = FALSE; 

										if (isset($elem_data['is_filterable']) && isset($foreign_data[$elem_name]) && count($foreign_data[$elem_name]) > 0){

											$filter_data = $foreign_data[$elem_name];
										
										} elseif (isset($elem_data['is_filterable']) && isset($elem_data['data']['options']) && count($elem_data['data']['options'])) {

											$filter_data = $elem_data['data']['options'];
										}
									?>
									@if ($filter_data)
										<?php $initial_filter_val = isset($user_filters[$elem_name]) ? $user_filters[$elem_name] : null ?>
										<?php $options = array('' => '') + $filter_data ?> {{-- this is needed to display the harvest/chosen placeholder --}}
										<?php $width = isset($elem_data['width']) ? $elem_data['width'] : '150px'; ?>
										{{ Form::select('filter-'.$elem_name, $options, $initial_filter_val, ['class'=>'table-filter chosen-select', 'style' => 'width: '.$width, 'data-placeholder' => $elem_data['label']]) }}
									@else 
										{{ $elem_data['label'] }}
									@endif
								</th>
							@endforeach

							@if ($user_can_delete)
								<th>{{-- Header for our delete buttons column --}}</th>
							@endif
						</tr>
					</thead>
				@endif
				
				{{ $list_inner_wrap[0] }}

					<?php 
						$list_data 		= compact('data', 'panel_data', 'row_opener', 'row_closer', 'user_can_update', 
											'user_can_delete', 'user_can_bulk_delete', 'item_element');
						$partial 		= $is_nestable ? 'list_nestables' : 'list_items'; 
					?>

					@include('station::partials.'.$partial, $list_data)

				{{ $list_inner_wrap[1] }}
				
			{{ $list_outer_wrap[1] }}


			{{-- we have more data in this list that we are not showing --}}
			@if ($raw_count > count($data['data']))
				<div class="station-list-load-more">
					<button class="btn btn-default btn-wide">
						Load More {{ str_plural($single_item_name) }}
					</button>
				</div>
			@endif


			@if ($user_can_delete) {{-- our modal for deletion confirmation is standing by --}}
				@include('station::partials.deleter')
			@endif

			@if ($user_can_bulk_delete) {{-- have a bottom tooltip ready to cofirm --}}
				<div class="fixed-bottom-tooltip for-bulk-delete">
					<p data-toggle="tooltip" title="..."></p>
				</div>
			@endif


			@if (count($data['data']) == 0) {{-- user is trying to filter but getting no data --}}
				<div class="alert">
		          <button type="button" class="close fui-cross" data-dismiss="alert"></button>
		          <h6>Didn't find any {{ str_plural(strtolower($single_item_name)) }} here.</h6>
		        </div>
			@endif
			
		@else {{-- we no have no stinking data --}}

			@if (!$is_trying_to_filter)
				
				{{-- show alert manually if desired --}}
				@if (isset($panel_data['panel_options']['no_data_alert']))
					<div class="alert">
			          <button type="button" class="close fui-cross" data-dismiss="alert"></button>
			          <h4>{{ $panel_data['panel_options']['no_data_alert']['header'] }}</h4>
			          <p>{{ $panel_data['panel_options']['no_data_alert']['body'] }}</p>
			        </div>
				
				{{-- give the `stock` no data message --}}
			    @else

					<div class="alert">
			          <button type="button" class="close fui-cross" data-dismiss="alert"></button>

			          <h4>You don't have any {{ str_plural(strtolower($single_item_name)) }} yet!</h4>

			          @if ($user_can_create)
				      	<button type="button" class="btn btn-success btn-wide" onclick="window.location = '{{ $panel_data['relative_uri'].'/create' }}'">
				      		Add your first {{ strtolower($single_item_name) }} now!
				      		<span class="fui-arrow-right"></span>
				      	</button>
				      @else 
				      	<p>
				      		It doesn't look like you have access to create new 
				      		{{ str_plural(strtolower($single_item_name)) }} either, though.
				      	</p>
				      @endif
			        </div>	

			    @endif
				
			@endif

		@endif

	</div>

@stop