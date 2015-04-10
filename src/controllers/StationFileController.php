<?php namespace Canary\Station\Controllers;

use Input, Response, Config, Session, Medium;
use Canary\Station\Models\Panel as Panel;
use Canary\Station\Models\Image_moo as Image_moo;
use Canary\Station\Models\OpenGraph as OpenGraph;
use Canary\Station\Models\S3 as S3;
use Canary\Station\Config\StationConfig as StationConfig;
//use Canary\Station\Models\Medium as Medium;
use Illuminate\Filesystem\Filesystem as File;

class StationFileController extends BaseController {

	public $tmp_dir = '';

	private $mock_width = 445;

	public function __construct()
    {
    	// make the tmp directory where we can access the uploads

    	$this->tmp_dir = storage_path().'/tmp';
    	
        if (!is_dir($this->tmp_dir)){

			mkdir($this->tmp_dir);
		}
    }

    public function crop(){

    	$file				= Input::get('filename');
    	$panel_name			= Input::get('panel_name');
		$element_name		= Input::get('element_name');
		$method				= Input::get('method');
		$coords				= Input::get('coords');
		$size_name			= Input::get('size_name');
		$panel				= new Panel;
		$user_scope			= $panel->user_scope($panel_name, $method);
		$element			= $user_scope['config']['elements'][$element_name];
		$size 				= $element['sizes'][$size_name];
		$app_config			= StationConfig::app();

		// fetch the original // TODO: we need to force all image uploads to save an original version. not an option. make it standard.
		$this->fetch_original($file, $app_config);

		$orig_size			= getimagesize($this->tmp_dir.'/'.$file);
		$orig_width			= $orig_size[0];
		$orig_height		= $orig_size[1];
		$this->mime 		= $orig_size['mime'];
		$mock_width			= $this->mock_width; // this is the width of the jcrop mock. fixed.
		$mock_height		= floor(($mock_width * $orig_height) / $orig_width);
		$mock_orig_ratio	= $orig_width / $mock_width;
		$target_orig_x 		= floor($coords['x'] * $mock_orig_ratio);
		$target_orig_x2 	= floor($coords['x2'] * $mock_orig_ratio);
		$target_orig_y 		= floor($coords['y'] * $mock_orig_ratio);
		$target_orig_y2		= floor($coords['y2'] * $mock_orig_ratio);

		$max_resize			= 99999;
		$specs				= explode('x', $size['size']);
		$x_val				= intval($specs[0]);
		$x_val				= $x_val == 0 ? $max_resize : $x_val;
		$y_val				= intval($specs[1]);
		$y_val				= $y_val == 0 ? $max_resize : $y_val;
		$letterbox_color	= isset($size['letterbox']) && $size['letterbox'] ? $size['letterbox'] : FALSE;

		$image = new Image_moo;
		$image->load($this->tmp_dir.'/'.$file); // TODO: need to set the BG color. not urgent.
		$image->crop($target_orig_x, $target_orig_y, $target_orig_x2, $target_orig_y2);
		$image->set_jpeg_quality(100);
		$image->save($this->tmp_dir.'/'.$file, TRUE);
		$image->clear();

		$image = new Image_moo;
		$image->load($this->tmp_dir.'/'.$file);
		$image->allow_scale_up(TRUE);
		$image->set_jpeg_quality(100);
		$image->resize($x_val, $y_val);
		$image->save($this->tmp_dir.'/_'.$file, TRUE);
		$this->send_to_s3('_'.$file, $size_name, $app_config); // send new file.

		// delete files from tmp directory. we are done with them
		unlink($this->tmp_dir.'/'.$file);
		unlink($this->tmp_dir.'/_'.$file);

		return Response::json(compact('mock_orig_ratio'));
    }

    public function manipulate_sizes_and_send_each($file, $sizes_needed, $app_config, $allow_upsize = TRUE){

		if (count($sizes_needed) == 0) return FALSE;

		$i			= 0;
		$max_resize	= 99999;

		// Setting connection to S3
		//$this->s3 = new S3($app_config['media_options']['AWS']['key'], $app_config['media_options']['AWS']['secret']);

		foreach ($sizes_needed as $directory => $version) {

			if (!isset($version['size']) || $version['size'] == ''){ // no sizing needed, just send original version

				$this->send_to_s3($file, $directory,$app_config, TRUE);

				if ($i == 0 && isset($version['trim_bg'])){

					$im = new \Imagick($this->tmp_dir.'/'.$file);
					$im->trimImage(0); 
					$im->writeImage($this->tmp_dir.'/'.$file);
				}

				continue;
			}

			$specs				= explode('x', $version['size']);
			$x_val				= intval($specs[0]);
			$x_val				= $x_val == 0 ? $max_resize : $x_val;
			$y_val				= intval($specs[1]);
			$y_val				= $y_val == 0 ? $max_resize : $y_val;
			$letterbox_color	= isset($version['letterbox']) && $version['letterbox'] ? $version['letterbox'] : FALSE;
			$method				= ($x_val == $max_resize || $y_val == $max_resize || $letterbox_color) ? 'resize' : 'resize_crop';
			
			if ($x_val == $max_resize && $y_val == $max_resize) continue; // nothing defined. not a well defined spec.

			$image = new Image_moo;
			$image->load($this->tmp_dir.'/'.$file);
			$image->set_background_colour($letterbox_color ?: '#000000');
			$image->set_jpeg_quality(100);
			$image->$method($x_val, $y_val, $letterbox_color ? TRUE : FALSE);
			$image->save($this->tmp_dir.'/_'.$file, TRUE); // save, keep original, prepend new file with underscore.
			$this->send_to_s3('_'.$file, $directory,$app_config); // send new file.

			$i++;
		}
		
		// make station large thumb, send to S3
		$image = new Image_moo;
		$image->load($this->tmp_dir.'/'.$file);
		$image->resize($this->mock_width, $max_resize); // station large thumb spec
		$image->set_jpeg_quality(100);
		$image->save($this->tmp_dir.'/_'.$file, TRUE);
		$this->send_to_s3('_'.$file, 'station_thumbs_lg',$app_config);

		// make station small thumb, send to S3
		$image = new Image_moo;
		$image->load($this->tmp_dir.'/'.$file);
		$image->resize(100, 100, '#FFFFFF'); // station large thumb spec
		$image->set_jpeg_quality(100);
		$image->save($this->tmp_dir.'/_'.$file, TRUE);
		$this->send_to_s3('_'.$file, 'station_thumbs_sm',$app_config);
		
		// delete upload from tmp directory. we are done with it
		unlink($this->tmp_dir.'/'.$file);
		unlink($this->tmp_dir.'/_'.$file);

		return array('n_sent' => $i, 'file_name' => $file);
	}

	public function process_url($panel_name, $element_name){

		$url = Input::get('url');

		if ($url){

			$graph = OpenGraph::fetch($url);
			$graph_arr = [];

			foreach ($graph as $key => $value) {
				
				if ($key == 'image') $value = $this->process_foreign_image_for($panel_name, $element_name, $value);

				$graph_arr[$key] = $value;
			}

			return Response::json(['status' => 1, 'graph' => $graph_arr]);
		}

		return Response::json(['status' => 0, 'message' => 'This is not a valid URL.']);
	}

	public function process_foreign_image_for($panel_name, $element_name, $source_url){

		$app_config        = StationConfig::app();
        $panel             = new Panel;
        $subpanel_name	   = Input::has('subpanel') && Input::get('subpanel') != '' ? Input::get('subpanel') : FALSE;
        $user_scope        = $panel->user_scope($subpanel_name ?: $panel_name, 'U', $subpanel_name ? $panel_name : FALSE);
        $element           = $user_scope['config']['elements'][$element_name];
        $allow_upsize      = isset($element['allow_upsize']) && $element['allow_upsize'];
        $all_sizes         = $panel->img_sizes_for($user_scope, $app_config);
        $sizes_needed      = isset($all_sizes[$element_name]) ? $all_sizes[$element_name] : $all_sizes['standard'];
        $ext               = pathinfo($source_url, PATHINFO_EXTENSION);
        $ext               = $ext == '' ? 'jpg' : $ext;
        $file_name         = md5(time().$source_url).'.'.$ext;
        $new_path          = $this->tmp_dir."/".$file_name;

        $this->fetch_source($source_url, $new_path);
        
        $manipulations     = $this->manipulate_sizes_and_send_each($file_name, $sizes_needed, $app_config, $allow_upsize);

        return $file_name;
	}

	public function upload()
	{

		if (!Input::hasFile('uploaded_file')) echo json_encode(['success' => FALSE, 'reason' => 'no file uploaded']);

		$file						= Input::file('uploaded_file');
		$original_file_name			= $file->getClientOriginalName();
		$size						= $file->getSize();
		$mime						= $file->getMimeType();
		$this->mime 				= $mime;
		$extension					= $file->getClientOriginalExtension();
		$path 			 			= pathinfo($original_file_name);
		$orig_name_wo_ext 			= $path['filename'];
		$new_file_name				= $orig_name_wo_ext.'_'.date('Y-m-d-H-i-s').'.'.$extension;
		$panel						= new Panel;
		$panel_name					= Input::get('panel_name');
		$parent_panel_name			= Input::get('parent_panel_name');
		$element_name				= Input::get('upload_element_name');
		$method						= Input::get('method');
		$user_scope					= $panel->user_scope($panel_name, $method, $parent_panel_name);
		$element					= $user_scope['config']['elements'][$element_name];
		$app_config					= StationConfig::app();
		$success 					= FALSE;
		$message 					= '';
		$field_is_uploadable 		= $element['type'] == 'image' || (isset($element['embeddable']) && $element['embeddable']);

		Input::file('uploaded_file')->move($this->tmp_dir, $new_file_name);

		if ($field_is_uploadable){

			$allowed_image_extensions	= ['png', 'gif', 'jpg', 'jpeg', 'PNG', 'GIF', 'JPG', 'JPEG'];
			$bad_image = strpos($mime, 'image') === FALSE || !in_array($extension, $allowed_image_extensions);

			if ($bad_image) return Response::json(['success' => FALSE, 'reason' => 'not a proper image']);

			$allow_upsize	= isset($element['allow_upsize']) && $element['allow_upsize'];
			$all_sizes		= $panel->img_sizes_for($user_scope, $app_config);
			$sizes_needed	= isset($all_sizes[$element_name]) ? $all_sizes[$element_name] : $all_sizes['standard'];
			$manipulations	= $this->manipulate_sizes_and_send_each($new_file_name, $sizes_needed, $app_config, $allow_upsize);
			$success 		= $manipulations['n_sent'] > 0;
			$message 		= $manipulations['n_sent'].' manipulations made and sent to S3';

		} else { // file?

			// TODO: deal with non-images here. check for allowed types. then just move and send to S3.
		}

		$response = [

			'success'		=> $success,
			'message'		=> $message,
			'insert_id'		=> isset($medium->id) ? $medium->id : FALSE,
			'file_uri_stub'	=> 'http://'.$app_config['media_options']['AWS']['bucket'].'.s3.amazonaws.com/',
			'file_uri'		=> isset($manipulations['file_name']) ? 'http://'.$app_config['media_options']['AWS']['bucket'].'.s3.amazonaws.com/'.'station_thumbs_lg/'.$manipulations['file_name'] : FALSE,
			'file_name'		=> isset($manipulations['file_name']) ? $manipulations['file_name'] : FALSE
        ];


        //return Response::json($response); // was erroring with Resource interpreted as Document but transferred with MIME type application/json: "/station/file/upload".
        echo json_encode($response);
        exit;
	}

	private function fetch_original($filename, $app_config){

    	$bucket = $app_config['media_options']['AWS']['bucket'];
    	$remote_filename = urlencode($filename);
    	$source_url = 'http://'.$bucket.".s3.amazonaws.com/original/".$remote_filename;
		copy($source_url, $this->tmp_dir."/".$filename);
    }

    private function fetch_source($source_url, $new_path){

        $ch = curl_init($source_url);
        $fp = fopen($new_path, "w");

        curl_setopt($ch, CURLOPT_FILE, $fp);
        curl_setopt($ch, CURLOPT_HEADER, 0);

        curl_exec($ch);
        curl_close($ch);
        fclose($fp);
    }

	private function send_to_s3($file, $s3_directory = '',$app_config, $is_orig = FALSE){

		$target = $is_orig ? $s3_directory."/".$file : $s3_directory."/".substr($file,1);
		$this->s3 = new S3($app_config['media_options']['AWS']['key'], $app_config['media_options']['AWS']['secret']);

		if (!isset($this->mime)){

			$size_tmp = getimagesize($this->tmp_dir.'/'.$file);
			$mime = $size_tmp['mime'];

		} else {

			$mime = $this->mime;
		}

		$this->s3->putObject(file_get_contents($this->tmp_dir.'/'.$file), $app_config['media_options']['AWS']['bucket'], $target, 'public-read',array(),$mime);
		unset($this->s3);
	}

	private function trim_bg($source_img){

		//load the image
		$img = $this->imageCreateFromAny($source_img);

		//find the size of the borders
		$b_top = 0;
		$b_btm = 0;
		$b_lft = 0;
		$b_rt = 0;

		//top
		for(; $b_top < imagesy($img); ++$b_top) {
		  for($x = 0; $x < imagesx($img); ++$x) {
		    if(imagecolorat($img, $x, $b_top) != 0xFFFFFF) {
		       break 2; //out of the 'top' loop
		    }
		  }
		}

		//bottom
		for(; $b_btm < imagesy($img); ++$b_btm) {
		  for($x = 0; $x < imagesx($img); ++$x) {
		    if(imagecolorat($img, $x, imagesy($img) - $b_btm-1) != 0xFFFFFF) {
		       break 2; //out of the 'bottom' loop
		    }
		  }
		}

		//left
		for(; $b_lft < imagesx($img); ++$b_lft) {
		  for($y = 0; $y < imagesy($img); ++$y) {
		    if(imagecolorat($img, $b_lft, $y) != 0xFFFFFF) {
		       break 2; //out of the 'left' loop
		    }
		  }
		}

		//right
		for(; $b_rt < imagesx($img); ++$b_rt) {
		  for($y = 0; $y < imagesy($img); ++$y) {
		    if(imagecolorat($img, imagesx($img) - $b_rt-1, $y) != 0xFFFFFF) {
		       break 2; //out of the 'right' loop
		    }
		  }
		}

		//copy the contents, excluding the border
		$newimg = imagecreatetruecolor(
		    imagesx($img)-($b_lft+$b_rt), imagesy($img)-($b_top+$b_btm));

			imagecopy($newimg, $img, 0, 0, $b_lft, $b_top, imagesx($newimg), imagesy($newimg));

		imagejpeg($newimg, $source_img);
	}

	function imageCreateFromAny($filepath) { 

	    $type = exif_imagetype($filepath); // [] if you don't have exif you could use getImageSize() 
	    $allowedTypes = array( 
	        1,  // [] gif 
	        2,  // [] jpg 
	        3,  // [] png 
	        6   // [] bmp 
	    ); 
	    if (!in_array($type, $allowedTypes)) { 
	        return false; 
	    } 
	    switch ($type) { 
	        case 1 : 
	            $im = imageCreateFromGif($filepath); 
	        break; 
	        case 2 : 
	            $im = imageCreateFromJpeg($filepath); 
	        break; 
	        case 3 : 
	            $im = imageCreateFromPng($filepath); 
	        break; 
	        case 6 : 
	            $im = imageCreateFromBmp($filepath); 
	        break; 
	    }    
	    return $im;  
	}
}
