<?php namespace Canary\Station\Controllers;

use View, App, Config, Session, Auth, Redirect, URL, Input, Response, Request;
use Canary\Station\Models\Panel as Panel;
use Canary\Station\Filters\Session as Station_Session;
use Illuminate\Filesystem\Filesystem as File;
use Canary\Station\Config\StationConfig as StationConfig;

class StationPanelController extends BaseController {

	protected $layout					= 'station::layouts.base';
	protected $subpanel_parent			= FALSE;
	protected $primary_element_value	= FALSE;
	protected $append_form_action		= '';
	protected $append_attempt_uri		= '';
	protected $subpanel_parent_uri		= '';
	protected $write_data_override		= FALSE;

	public function create($panel_name){

		$method = 'C';

		$this->init($panel_name, $method);

		$user_can_create = $this->can_create($panel_name);

		if (!$user_can_create) return Redirect::back()->with('error', 'You do not have access to that area.');
		
		$panel					= new Panel;
		$panel_data_with_count	= $panel->get_data_for($panel_name, TRUE);
		$title					= 'Create a new '.$this->single_item_name;
		$title					.= $this->primary_element_value ? ' for "'.$this->primary_element_value.'"' : '';

		View::share('n_items_in_panel', $panel_data_with_count['data']);
		View::share('method', $method);
		View::share('page_title', $title);
		View::share('layout_title', $title);
		View::share('form_action', $this->base_uri.'panel/'.$this->name.$this->append_form_action);
		View::share('form_method', 'POST');
		View::share('form_purpose','create');
		View::share('submit_value', 'Save this '.$this->single_item_name);

		if ($this->subpanel_parent) $this->load_js_include($this->user_scope);
		if ($this->subpanel_parent) $this->load_css_include($this->user_scope);

		return $this->render('form', $panel_data_with_count, $method);
	}

	public function create_in_subpanel($panel_name, $parent_panel, $parent_id){

		$this->init_subpanel('C', $panel_name, $parent_panel, $parent_id);
		return $this->create($panel_name);
	}

	public function create_user(){

		if (Auth::check()) return Redirect::to(StationConfig::app('root_uri_segment').'/login');

		$this->assets['css'][] = 'login.css';
		$panel_name = StationConfig::app('panel_for_user_create');
		return $this->create($panel_name);
	}

	public function do_create($panel_name){

		$panel			= new Panel;
		$user_scope 	= $panel->user_scope($panel_name, 'C', $this->subpanel_parent); // can we create? which fields?

		if (!$user_scope) return Redirect::back()->with('error', 'You do not have access to that area.');

		$this->init($panel_name, 'C');

		$override_response = $this->override_responded_to($user_scope, 'C');
		if ($override_response) return $override_response;

		$validator 	 	= $panel->validates_against($panel_name, $user_scope);
		$attempt_uri 	= isset($this->is_creating_user) ? '/'.$this->base_uri.'register/' : '/'.$this->base_uri.'panel/'.$panel_name.'/create';
		$attempt_uri 	= $attempt_uri.$this->append_attempt_uri;

		if ($validator->fails()){ // flash error and redirect to form

			if (Request::ajax()){

				$errors = array('ajax_errors' => $validator->getMessageBag()->toArray());
				$error_flash = View::make('station::layouts.header', $errors)->render();
				return Response::json(['status' => 0, 'flash' => $error_flash]);

			} else {

				return Redirect::to($attempt_uri)->withErrors($validator)->withInput();
			}
		
		} else { // save and redirect

			// Is there a pre_trigger?
			if(isset($this->panel_config['panel_options']['trigger']['pre']['C']))
			{
				$temp = explode('@', $this->panel_config['panel_options']['trigger']['pre']['C']);
				$override_controller 	= $temp[0];
				$override_method 		= $temp[1];

				App::make($override_controller)->$override_method(Input::all());
			}


			$record_id = $panel->create_record_for($panel_name, $user_scope, isset($this->is_creating_user), $this->write_data_override);

			if (is_numeric($record_id)){ // record was saved

				// Is there a post_trigger?
				if(isset($this->panel_config['panel_options']['trigger']['post']['C']))
				{
					$temp = explode('@', $this->panel_config['panel_options']['trigger']['post']['C']);
					$override_controller 	= $temp[0];
					$override_method 		= $temp[1];

					App::make($override_controller)->$override_method($record_id);
				}


				if (Request::ajax()){

					return Response::json(['status' => 1, 'record_id' => $record_id]);

				} else {

					if (isset($this->is_creating_user)){ // this is a new account. find out where they should go first, log them in and redirect

						Auth::loginUsingId($record_id);
						Station_Session::hydrate();

						$uri			= Session::get('user_data.starting_panel_uri');
						$message		= 'Your account has been added and you are logged in!';

					} else { // just creating a new record in general

						$user_wants_to_create_another = Input::get('after_save') == 'create';

						$append 	= $this->subpanel_parent_uri != '' ? $this->subpanel_parent_uri : '/'.$panel_name;
						$uri		= '/'.$this->base_uri.'panel'.$append;
						$uri 		= $user_wants_to_create_another ? $attempt_uri : $uri;
						$message	= 'Your new '.strtolower($this->single_item_name).' has been added. ';
						$message 	.= $user_wants_to_create_another ? 'Create a another below.' : '';
					}

					return Redirect::to($uri)->with('success', $message);
				}
			}

			return Redirect::to($attempt_uri)->with('error', 'Something went wrong with saving :('); // TODO: log this.
		}
	}

	public function do_create_in_subpanel($panel_name, $parent_panel, $parent_id){

		$this->init_subpanel('C', $panel_name, $parent_panel, $parent_id);
		return $this->do_create($panel_name);
	}

	public function do_create_user(){

		if (Auth::check()) return Redirect::to(StationConfig::app('root_uri_segment').'/login');

		$panel_for_user_create = StationConfig::app('panel_for_user_create');
		$this->is_creating_user = TRUE;
		return $this->do_create($panel_for_user_create);
	}

	public function do_delete($panel_name, $ids){

		$this->init($panel_name, 'D', $ids);
		$user_can_delete = $this->can_delete($panel_name);
		$ids_arr = explode(',', $ids);

		if ($user_can_delete && count($ids_arr) > 0) {

			// Is there a pre_trigger?
			if(isset($this->panel_config['panel_options']['trigger']['pre']['D']))
			{
				$temp = explode('@', $this->panel_config['panel_options']['trigger']['pre']['D']);
				$override_controller 	= $temp[0];
				$override_method 		= $temp[1];

				App::make($override_controller)->$override_method($id);
			}

			
			$panel = new Panel;

			foreach ($ids_arr as $id) {

				$panel->delete_record_for($panel_name, $id);
			}

			// Is there a post_trigger?
			if(isset($this->panel_config['panel_options']['trigger']['post']['D']))
			{
				$temp = explode('@', $this->panel_config['panel_options']['trigger']['post']['D']);
				$override_controller 	= $temp[0];
				$override_method 		= $temp[1];

				App::make($override_controller)->$override_method();
			}

			
			return Response::json(array('status' => '1', 'message' => count($ids_arr).' record(s) were deleted'));
		}

		return Response::json(array('status' => '0', 'message' => 'The record(s) were not deleted'));
	}

	public function do_delete_in_subpanel($panel_name, $parent_panel, $parent_id, $id){

		$this->init_subpanel('D', $panel_name, $parent_panel, $parent_id);
		return $this->do_delete($panel_name, $id);
	}

	public function do_reorder($panel_name){
		
		if (!Input::get('ids')) return Response::json(array('status' => 0, 'reason' => 'no reorder instructions'));

		$this->init($panel_name, 'L'); // let's say the user is allowed to reorder if they can access the list
		
		$opts			= $this->panel_config['panel_options'];
		$reorder_column	= isset($opts['reorderable_by']) && $opts['reorderable_by'] ? $opts['reorderable_by'] : FALSE;

		if (!$reorder_column) return Response::json(array('status' => 0, 'reason' => 'no column to reorder on'));

		$panel		= new Panel;
		$panel_data	= $panel->get_data_for($panel_name, FALSE, $this->subpanel_parent);

		if (!$panel_data) return Response::json(array('status' => 0, 'reason' => 'no panel data to reorder'));
		
		$reordered = $panel->reorder($opts['table'], $reorder_column, Input::get('ids'));

		return Response::json(array('status' => $reordered ? 1 : 0));
	}

	public function do_reorder_nested($panel_name){
		
		if (!Input::get('nested_ids')) return Response::json(array('status' => 0, 'reason' => 'no reorder instructions'));

		$this->init($panel_name, 'L'); // let's say the user is allowed to reorder if they can access the list
		
		$opts		= $this->panel_config['panel_options'];
		$columns	= isset($opts['nestable_by']) && $opts['nestable_by'] ? $opts['nestable_by'] : FALSE;

		if (!$columns) return Response::json(array('status' => 0, 'reason' => 'no columns to write to or not configured'));

		$panel		= new Panel;
		$panel_data	= $panel->get_data_for($panel_name, FALSE, $this->subpanel_parent); // not allowing nested yet in subpanels.

		if (!$panel_data) return Response::json(array('status' => 0, 'reason' => 'no panel data to reorder'));
		
		$reordered = $panel->reorder_nested($opts['table'], $columns, Input::get('nested_ids'));

		return Response::json(array('status' => $reordered ? 1 : 0));
	}

	public function do_reorder_in_subpanel($panel_name, $parent_panel, $parent_id){

		$this->init_subpanel('U', $panel_name, $parent_panel, $parent_id);
		return $this->do_reorder($panel_name);
	}

	public function do_update($panel_name, $id){

		$panel			= new Panel;
		$user_scope 	= $panel->user_scope($panel_name, 'U', $this->subpanel_parent); // can we update? which fields?

		if (!$user_scope) return Redirect::back()->with('error', 'You do not have access to that area.');

		$this->init($panel_name, 'U', $id);

		$validator		= $panel->validates_against($panel_name, $user_scope, $id);
		$attempt_uri	= '/'.$this->base_uri.'panel/'.$panel_name.'/update/'.$id;
		$attempt_uri	= $attempt_uri.$this->append_attempt_uri;
		$append			= $this->subpanel_parent_uri != '' ? $this->subpanel_parent_uri : '/'.$panel_name;
		$uri			= '/'.$this->base_uri.'panel'.$append;
		$edit_uri		= $uri.'/update/'.$id; // TODO: this is wrong on subpanel edits.
		$relative_uri 	= '/'.$this->base_uri.'panel'.'/'.$panel_name;
		$success_uri	= isset($user_scope['registry']['uri_slug']) ? $relative_uri.'/'.$panel->inject_vars($user_scope['registry']['uri_slug']) : $uri; 
		$user_will_stay = Input::get('after_save') == 'stay';
		$redirect_uri 	= $user_will_stay ? $attempt_uri : $success_uri;

		if ($validator->fails()){ // flash error and redirect to form

			if (Request::ajax()){

				$errors = array('ajax_errors' => $validator->getMessageBag()->toArray());
				$error_flash = View::make('station::layouts.header', $errors)->render();
				return Response::json(['status' => 0, 'flash' => $error_flash]);

			} else {

				return Redirect::to($attempt_uri)->withErrors($validator)->withInput();
			}
		
		} else { // save and redirect

			// Is there a pre_trigger?
			if(isset($this->panel_config['panel_options']['trigger']['pre']['U']))
				{
					$temp = explode('@', $this->panel_config['panel_options']['trigger']['pre']['U']);
					$override_controller 	= $temp[0];
					$override_method 		= $temp[1];

					App::make($override_controller)->$override_method($id);
				}

			if ($panel->update_record_for($panel_name, $user_scope, $id)){

				// Is there a post_trigger?
				if(isset($this->panel_config['panel_options']['trigger']['post']['U']))
				{
					$temp = explode('@', $this->panel_config['panel_options']['trigger']['post']['U']);
					$override_controller 	= $temp[0];
					$override_method 		= $temp[1];

					App::make($override_controller)->$override_method($id);
				}

				if (Request::ajax()){

					return Response::json(['status' => 1, 'record_id' => $id]);

				} else {

					$message 			= 'This '.strtolower($this->single_item_name).' has been edited. ';
					$more_edits_html 	= 'Make <a class="more-edits" data-panel-name="'.$panel_name.'" '
										. 'data-id="'.$id.'" href="'.$edit_uri.'">more edits</a>.';
					$message 			.= !$user_will_stay ? $more_edits_html : '';
					
					return Redirect::to($redirect_uri)->with('success', $message);
				}
			}

			return Redirect::to($attempt_uri)->with('error', 'Something went wrong with saving :(');
		}
	}

	/**
	 * response to AJAX PUT request where user is attempting to update a single field
	 *
	 * @param  string  $panel_name 
	 * @param  string  $element_name 
	 * @param  int $id
	 * @return Response::json
	 */
	public function do_update_element($panel_name, $element_name, $id, $response_type = 'response'){

		$panel			= new Panel;
		$user_scope 	= $panel->user_scope($panel_name, 'U', $this->subpanel_parent); // can we update? which fields?

		if (!$user_scope) return Redirect::back()->with('error', 'You do not have access to that area.');

		$this->init($panel_name, 'U', $id);

		$user_scope 	= $panel->filter_scope_elements($user_scope, [$element_name]);
		$validator		= $panel->validates_against($panel_name, $user_scope, $id);

		if ($validator->fails()){

			$response = ['status' => 0, 'message' => $validator->getMessageBag()->toArray()];

		} else {

			$panel->update_record_for($panel_name, $user_scope, $id);
			$response = ['status' => 1, 'message' => 'Update was successful'];
		}

		return $response_type == 'response' ? Response::json($response) : $response;
	}

	public function do_update_element_for_ids($panel_name, $element_name, $ids){

		$ids_arr = explode(',', $ids);
		$n_updated = 0;

		foreach ($ids_arr as $id) {
			
			$update_status = $this->do_update_element($panel_name, $element_name, $id, 'array');
			$n_updated += $update_status['status'] == 1 ? 1 : 0;
		}

		$response = ['status' => 1, 'message' => 'Updated '.$n_updated.' item(s).'];
		return Response::json($response);
	}

	public function do_update_element_in_subpanel($panel_name, $parent_panel, $parent_id, $element_name, $id){

		$this->init_subpanel('U', $panel_name, $parent_panel, $parent_id);
		return $this->do_update_element($panel_name, $element_name, $id);
	}

	public function do_update_in_subpanel($panel_name, $id, $parent_panel, $parent_id){

		$this->init_subpanel('U', $panel_name, $parent_panel, $parent_id);
		return $this->do_update($panel_name, $id);
	}

	public function index($panel_name){

		$panel			= new Panel;
		$panel_data		= $panel->get_data_for($panel_name);

		if (!$panel_data) return Redirect::back()->with('error', 'You do not have access to that area.');

		$this->init($panel_name, 'L');

		$raw_count 					= $panel->get_data_for($panel_name, TRUE, FALSE, FALSE, FALSE, TRUE);
		$raw_count 					= $raw_count['data'];
		$is_trying_to_filter 		= $panel_data['has_user_filters'];
		$panel_options				= $this->panel_config['panel_options'];
		$force_create				= isset($panel_options['no_data_force_create']) && $panel_options['no_data_force_create'];
		$no_data_and_force_create	= count($panel_data['data']) == 0 && $force_create;
		
		if ($no_data_and_force_create && !$is_trying_to_filter) return Redirect::to($this->panel_config['relative_uri'].'/create');

		$this->foreign_data = $panel->add_all_to_array($this->foreign_data);

		$user_can_create		= $this->can_create($panel_name);
		$user_can_update		= $this->can_update($panel_name);
		$user_can_delete		= $this->can_delete($panel_name);
		$user_can_bulk_delete	= $user_can_delete && isset($panel_options['allow_bulk_delete']) && $panel_options['allow_bulk_delete'];
		$title					= $this->user_scope['registry']['name'];

		View::share('raw_count', $raw_count);
		View::share('is_trying_to_filter', $is_trying_to_filter);
		View::share('user_filters', $panel_data['user_filters']);
		View::share('foreign_data', $this->foreign_data);
		View::share('user_can_create', $user_can_create);
		View::share('user_can_update', $user_can_update);
		View::share('user_can_delete', $user_can_delete);
		View::share('user_can_bulk_delete', $user_can_bulk_delete);
		View::share('page_title', $title);
		View::share('layout_title', $title);
		View::share('data', $panel_data);
		
		return $this->render('list', $panel_data, 'L');
	}

	public function init_subpanel($method, $panel_name, $parent_panel, $parent_id){

		$slug_map						= ['C' => '/create', 'U' => '', 'D' => ''];
		$panel							= new Panel;
		$this->subpanel_parent			= $parent_panel;
		$parent_record_object			= $panel->get_record_for($parent_panel, $parent_id);
		$key 							= isset($parent_record_object['config']['elements'][$panel_name]['data']['key']) ? 
											$parent_record_object['config']['elements'][$panel_name]['data']['key'] : FALSE;

		if (!$key) dd('Subpanels require a foreign key to be defined.');

		$this->write_data_override 		= [$key => $parent_id]; 
		$this->parent_record			= $parent_record_object['data']->toArray();
		$this->primary_element_value	= $panel->primary_element_value($this->parent_record);
		$this->append_form_action 		= $slug_map[$method].'/for/'.$parent_panel.'/'.$parent_id;
		$this->append_attempt_uri 		= '/for/'.$parent_panel.'/'.$parent_id;
		$this->subpanel_parent_uri 		= '/'.$parent_panel.'/update/'.$parent_id; // our target will always be the 'update' view

		View::share('curr_subpanel', $panel_name);
	}

	public function search($panel_name){

		$term = Input::get('term');

		if (!$term || strlen($term) < 3) return Response::json(['status' => 0]);

		$this->init($panel_name, 'L');

		$panel			= new Panel;
		$panel_data		= $panel->get_data_for($panel_name, FALSE, FALSE, FALSE, $term);
		$ret 			= [];

		if (count($panel_data['data']) > 0){

			foreach ($panel_data['data'] as $item) {
				
				$ret[] = ['id' => $item['id'], 'value' => $item['name'], 'label' => $item['name']];
			}

		} else {

			$ret[] = ['id' => 0, 'value' => 'No results found', 'label' => 'No results found'];
		}

		return Response::json($ret);
	}

	public function update($panel_name, $id){

		$panel		= new Panel;
		$panel_data	= $panel->get_record_for($panel_name, $id, $this->subpanel_parent);
		$panel_data['data']['id'] = (int)$id;

		$method = 'U';

		if (!$panel_data || !$panel_data['data']) return Redirect::back()->with('error', 'You do not have access to that area.');

		$this->init($panel_name, $method, $id);

		$title					= 'Edit This '.$this->single_item_name;
		$title					.= $this->primary_element_value ? ' for "'.$this->primary_element_value.'"' : '';
		$panel_data_with_count	= $panel->get_data_for($panel_name, TRUE);
		$adjacents 				= $panel->adjacents_for($id, $panel_name);

		View::share('adjacents', $adjacents);
		View::share('curr_record_id', $id);
		View::share('n_items_in_panel', $panel_data_with_count['data']);
		View::share('passed_model', $panel_data['data']);
		View::share('page_title', $title);
		View::share('method', $method);
		View::share('layout_title', $title);
		View::share('form_action', $this->base_uri.'panel/'.$this->name.'/update/'.$id.$this->append_form_action);
		View::share('form_method', 'PUT');
		View::share('form_purpose', 'update');
		View::share('submit_value', 'Save this '.$this->single_item_name);

		return $this->render('form', $panel_data, $method);
	}

	public function update_in_subpanel($panel_name, $id, $parent_panel, $parent_id){

		$this->init_subpanel('U', $panel_name, $parent_panel, $parent_id);
		return $this->update($panel_name, $id);
	}



	protected function init($panel_name, $method = 'L', $id = 0){

    	$panel 					= new Panel;
		$this->id				= $id;
		$this->name				= $panel_name;
		$this->app_config		= StationConfig::app();
		$this->user_scope		= $panel->user_scope($this->name, $method, $this->subpanel_parent);

		// temp handling if someone is trying to access something they shouldn't		
		if(!$this->user_scope) dd('You do not have access to this'); // TODO: change handling. log it??
		
		$this->panel_config 	= $this->user_scope['config'];
		$this->single_item_name	= $this->panel_config['panel_options']['single_item_name'];
		$this->user_data		= Session::get('user_data');
		$this->assets			= isset($this->assets) ? $this->assets : [];
		$this->base_uri			= StationConfig::app('root_uri_segment').'/';
		$this->foreign_data 	= $panel->foreign_data_for($this->user_scope, $method);  
		$this->foreign_panels 	= $panel->foreign_panels_for($this->user_scope, $method);
		$this->array_img_size 	= $panel->img_sizes_for($this->user_scope, $this->app_config);
		$this->curr_panel 		= $this->subpanel_parent ?: $this->name;

		$this->panel_config['relative_uri']	= $this->base_uri.'panel/'.$this->name;
		$this->panel_config['relative_uri']	= URL::to($this->panel_config['relative_uri']);

		View::share('custom_vars', $panel->custom_view_vars());
		View::share('base_uri', $this->base_uri);
		View::share('base_img_uri', 'http://'.$this->app_config['media_options']['AWS']['bucket'].'.s3.amazonaws.com/');
		View::share('curr_panel', $this->curr_panel);
		View::share('curr_method', $method);
		View::share('curr_id', $id);
		View::share('single_item_name', $this->single_item_name);
        View::share('app_data', $this->app_config);
        View::share('panel_data', $this->panel_config);
        View::share('panel_name', $this->name);
        View::share('foreign_data', $this->foreign_data);
        View::share('foreign_panels', $this->foreign_panels);
        View::share('user_data', $this->user_data);
        View::share('base_uri', $this->base_uri);
        View::share('img_size_data', $this->array_img_size);
        View::share('sidenav_data', $panel->user_panel_access_list());
    }



	private function can_create($panel_name){

		if ($this->subpanel_parent && $this->user_scope){

			return TRUE;
		}

		if ((isset($this->user_data['primary_group']) 
			&& strpos($this->app_config['user_groups'][$this->user_data['primary_group']]['panels'][$panel_name]['permissions'],'C') !== FALSE)
			|| $panel_name == $this->app_config['panel_for_user_create']){

			return TRUE;
		}

		return FALSE;
	}

	private function can_delete($panel_name){

		if ($this->subpanel_parent && $this->user_scope){

			return TRUE;
		}

		if ((isset($this->user_data['primary_group']) 
			&& strpos($this->app_config['user_groups'][$this->user_data['primary_group']]['panels'][$panel_name]['permissions'],'D') !== FALSE)){

			return TRUE;
		}

		return FALSE;
	}

	private function can_update($panel_name){

		if ((isset($this->user_data['primary_group']) 
			&& strpos($this->app_config['user_groups'][$this->user_data['primary_group']]['panels'][$panel_name]['permissions'],'U') !== FALSE)){

			return TRUE;
		}

		return FALSE;
	}

	private function configure_form_view($panel_data){

		$this->assets['js'][]	= 'base.form.js?v4';
		$this->assets['js'][]	= 'chosen_v1.0.0/chosen.jquery.min.js';
		$this->assets['js'][]	= 'tapmodo-Jcrop-1902fbc/js/jquery.Jcrop.min.js';
		$this->assets['js'][]	= 'query-datetime/jquery.datetimeentry.min.js';
		$this->assets['js'][]	= 'zeroclipboard-1.3.5/ZeroClipboard.js';
		$this->assets['css'][]	= 'chosen.css';
		$this->assets['css'][]	= 'jquery.Jcrop.min.css';
	}

	private function configure_list_view($panel_data){

		$is_reorderable 		= count($panel_data['data']) > 1 
								&& isset($this->panel_config['panel_options']['reorderable_by']) 
								&& $this->panel_config['panel_options']['reorderable_by'];

		$is_nestable 			= count($panel_data['data']) > 1 
								&& isset($this->panel_config['panel_options']['nestable_by']) 
								&& $this->panel_config['panel_options']['nestable_by'];

		$list_attribs			= 'data-relative-uri="'.$this->panel_config['relative_uri'].'" '
								. 'data-single-item-name="'.$this->single_item_name.'" '
								. 'data-plural-item-name="'.str_plural($this->single_item_name).'" '
								. 'data-panel-name="'.$this->curr_panel.'" ';

		$table_wrap				= array('<table class="table table-hover station-list" '.$list_attribs.'>', '</table>');
		$tbody_wrap				= array('<tbody>', '</tbody>');
		$reorderable_classes	= 'list-group is-reorderable station-list';
		$nestable_classes 		= 'list-group is-nestable station-list';
		$ul_wrap				= array('<ul data-panel-name="'.$this->curr_panel.'" '.$list_attribs.' class="'.$reorderable_classes.'">', '</ul>');
		$nestable_wrap			= array('<div data-panel-name="'.$this->curr_panel.'" '.$list_attribs.' class="'.$nestable_classes.'">', '</div>');
		$no_wrap				= array('', '');
		$list_inner_wrap		= !$is_reorderable ? $tbody_wrap : $ul_wrap;
		$list_inner_wrap		= $is_nestable ? $nestable_wrap : $list_inner_wrap;

		$this->assets['js'][]	= 'base.list.js?v2';
		$this->assets['js'][]	= 'chosen_v1.0.0/chosen.jquery.min.js';
		$this->assets['css'][]	= 'chosen.css';
		$this->assets['css'][]	= 'jquery-ui-1.10.3.custom.min.css'; // TODO: generate new one & remove datepicker styles - can't have in form view

		if ($is_nestable) $this->assets['js'][] = 'jquery.nestable.js';

		View::share('is_reorderable', $is_reorderable);
		View::share('is_nestable', $is_nestable);
		View::share('list_attribs', $list_attribs);
		View::share('table_wrap', $table_wrap);
		View::share('tbody_wrap', $tbody_wrap);
		View::share('ul_wrap', $ul_wrap);
		View::share('no_wrap', $no_wrap);
		View::share('list_outer_wrap', !$is_reorderable && !$is_nestable ? $table_wrap : $no_wrap);
		View::share('list_inner_wrap', $list_inner_wrap);
		View::share('row_opener', !$is_reorderable ? '<tr' : '<li class="list-group-item"');
		View::share('row_closer', !$is_reorderable ? '</tr>' : '</li>');
		View::share('item_element', !$is_reorderable && !$is_nestable ? 'td' : 'span');
	}

	private function load_css_include($panel_data){

		if (isset($panel_data['config']['panel_options']['css_include']) && $panel_data['config']['panel_options']['css_include'] != ''){

			if (is_array($panel_data['config']['panel_options']['css_include'])){

				foreach($panel_data['config']['panel_options']['css_include'] as $css_file){

					$this->assets['css'][] = $css_file;
				}

			} else {

				$this->assets['css'][] = $panel_data['config']['panel_options']['css_include'];
			}
		}
	}

	private function load_js_include($panel_data){

		if (isset($panel_data['config']['panel_options']['js_include']) && $panel_data['config']['panel_options']['js_include'] != ''){

			if (is_array($panel_data['config']['panel_options']['js_include'])){

				foreach($panel_data['config']['panel_options']['js_include'] as $js_file){

					$this->assets['js'][] = $js_file;
				}

			} else {

				$this->assets['js'][] = $panel_data['config']['panel_options']['js_include'];
			}
		}
	}

	private function override($panel_data, $letter = 'L'){

		// if there is an override
		$controller 	= false;
		$method 		= false;

		if(isset($panel_data['config']['panel_options']['override'][$letter]))
		{
			$temp 			= explode('@', $panel_data['config']['panel_options']['override'][$letter]);
			$controller 	= $temp[0];
			$method 		= isset($temp[1]) ? $temp[1] : FALSE;
		}

		if (!$controller || !$method){

			return FALSE;
		}

		return array('controller' => $controller, 'method' => $method);
	}

	private function override_responded_to($user_scope, $method){

		$override = $this->override($user_scope, $method);
		if ($override)
		{
			$override['method'] = str_replace('%user_id%', Session::get('user_data.id'), $override['method']);
			if(isset($user_scope['data']->id)) $override['method'] = str_replace('%id%', $user_scope['data']->id, $override['method']);
			if(strpos($override['method'], '('))
			{
				// need to separate into array
				$vars = substr($override['method'], strpos($override['method'], '(')+1);
				$vars = substr($vars, 0,-1); // to trim the closing paranthesis
				$override['method'] = substr($override['method'],0,strpos($override['method'], '('));
			}
			else $vars = '';
			return App::make($override['controller'])->$override['method']($vars);

		}

		return FALSE;
	}

	private function render($template = 'list', $panel_data = array(), $method = 'L'){

		View::share('panel_name', $this->name);
		View::share('parent_panel_name', $this->subpanel_parent);
		View::share('subpanel_parent_uri', $this->subpanel_parent ? '/'.$this->base_uri.'panel'.$this->subpanel_parent_uri : FALSE);

		// if has button overrides, we want to pass those vals along
		if(isset($panel_data['config']['panel_options']['button_override'][$method]))
		{
			View::share('button_override',$panel_data['config']['panel_options']['button_override'][$method]);
		}
		
		if (Request::ajax()) return $this->render_ajax($template, $panel_data, $method);

		$configure_method = 'configure_'.$template.'_view';
		$this->$configure_method($panel_data);
		$this->load_js_include($panel_data);
		$this->load_css_include($panel_data);

		$override_response	= $this->override_responded_to($panel_data, $method);
		$view = $override_response ? $override_response : View::make('station::layouts.'.$template);

		if (is_object($view) && get_class($view) == 'Symfony\Component\HttpFoundation\BinaryFileResponse') return $view;
		if (is_array($view) && isset($view['is_redirect']) && isset($view['target_uri'])) return Redirect::to($view['target_uri']);

		View::share('assets', $this->assets);
		$this->layout->content 	= $view;
	}

	private function render_ajax($template = 'list', $panel_data = array(), $method = 'L'){

		switch ($template) {

			case 'form':
				
				// ajax forms? might happen
				break;

			case 'list':
				
				$this->configure_list_view($panel_data);
				return View::make('station::partials.list_items');
		}
	}
}

