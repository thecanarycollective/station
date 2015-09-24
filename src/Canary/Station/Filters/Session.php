<?php namespace Canary\Station\Filters;

use Auth, Redirect, Config, Request, Session as Laravel_Session;
use Canary\Station\Models\User as User;
use Canary\Station\Models\Panel as Panel;
use Canary\Station\Config\StationConfig as StationConfig;

class Session {

    /**
     * If the user is not logged in then we need to get them outta here.
     * 
     * @return mixed
     */
    public function filter()
    {
    	$this->base_uri = StationConfig::app('root_uri_segment').'/';

        if (Auth::guest()) {

            Laravel_Session::put('desired_uri', Request::getRequestUri());
            return Redirect::to($this->base_uri.'login');
        }

		if (!Laravel_Session::has('user_data')) $this->hydrate();
    }

    /**
     * populate the user_data
     *
     * @param  type  $param
     * @return void
     */
    static function hydrate(){

		$user_id			= Auth::user()->id;
		$user				= User::find($user_id);
		$group_names		= $user->groups->lists('name'); 
		$primary_group		= current($group_names);
		$app_groups			= StationConfig::app('user_groups');
		$starting_panel		= $app_groups[$primary_group]['starting_panel'];
		$starting_panel_uri	= Panel::config_to_uri($starting_panel);

		Laravel_Session::put('user_data', array(

            'id'                    => $user_id,
			'groups'				=> $group_names,
			'primary_group'			=> $primary_group,
			'starting_panel'		=> $starting_panel,
			'starting_panel_uri'	=> $starting_panel_uri,
            'name'                  => $user['first_name'].' '.$user['last_name'],
            'email'                 => $user['email'],
            'username'              => $user['username'],
            'gravatar_hash'         => md5($user['email'])
		));
    }
}