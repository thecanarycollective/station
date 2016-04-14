<?php namespace Canary\Station\Commands;

use Illuminate\Console\Command;
use Illuminate\Filesystem\Filesystem as File;
use Symfony\Component\Console\Input\InputOption;
use Symfony\Component\Console\Input\InputArgument;
use Config;
use Schema;
use App;
use Canary\Station\Models\Panel as Panel;
use Canary\Station\Config\StationConfig as StationConfig;

class Build extends Command {

	/**
	 * The console command name.
	 *
	 * @var string
	 */
	protected $name = 'station:build';

	/**
	 * The console command description.
	 *
	 * @var string
	 */
	protected $description = 'Rebuilds the station package (generates migrations, migrates, and seeds)';

	protected $gen_begin = '//GEN-BEGIN';
	protected $gen_end = '//GEN-END';

	/**
	 * Create a new command instance.
	 *
	 * @return void
	 */
	public function __construct()
	{
		parent::__construct();

		$this->pivot = array();
		$this->model_output = array();
		$this->valid_relationships = array('hasOne','hasMany','belongsTo','belongsToMany');
		//$this->file = $file;
	}

	/**
	 * Execute the console command.
	 * This builds the station up to latest DB, Seeds, and Panel Config.
	 * 
	 * runs generate:migration for each panel 
	 * runs generate:pivot for pivot tables 
	 * runs migrate 
	 * runs db:seed using the StationDatabaseSeeder
	 *
	 * @return void
	 */
	public function fire()
	{

		$panel = new Panel;
        $panels = $panel->all(TRUE); // gets subpanels too.
        $this->generate_migrations($panels); 
        $this->call('migrate');
        $this->generate_models($panels);
        $this->call('db:seed',array('--class'=>"StationDatabaseSeeder"));
        $this->call('dump-autoload');
        echo $this->print_output();
	}

	/**
	 * suffix/extension for generator fields
	 * also adds the default value
	 *
	 * @param  string  $type
	 * @return string
	 */
	private function column_type_suffix($element){

		// first find the column type we need
		switch($element['type'])
		{
			case 'text':
				$ret = ':string';
				break;
			case 'email':
				$ret = ':string';
				break;
			case 'password':
				$ret = ':string';
				break;
			case 'date':
				$ret = ':date';
				break;
			case 'datetime':
				$ret = ':datetime';
				break;
			case 'radio':
				$ret = ':integer';
				break;
			case 'select':
				$ret = ':integer';
				break;
			case 'int':
				$ret = ':integer';
				break;
			case 'integer':
				$ret = ':integer';
				break;
			case 'image':
				$ret = ':string';
				break;
			case 'textarea':
				$ret = ':text';
				break;
			case 'parsed_url':
				$ret = ':string';
				break;
			case 'float':
				$ret = ':float';
				break;
			case 'boolean':
				$ret = ':boolean:nullable';
				break;
			default:
				$ret = ':string';
				break;
		}

		// then set a default value for the field if we have one 
		// AND if the default does not use a variable (%)
		if (isset($element['default']) && strpos($element['default'], '%') === FALSE){

			$ret .= ":default('".$element['default']."')";
		}

		return $ret;
	}

	/**
	 * creates string for generator 
	 *
	 * @param  string  $table_name
	 * @param  string  $data // panel data
	 * @return string
	 */
	private function fields_string_for_elements($table_name, $data){

		$fields		= '';

        foreach($data['elements'] as $att_name => $att_data)
        {
        	$fields .= $this->process_element($table_name,$att_name,$att_data);
        }

        $fields = rtrim($fields,', ');

        return $fields;
	}

	/**
	 * fires the generate:migrations command
	 * 
	 * right now we need to call `migrate` on every generation because if we wait til the end then some 
	 * columns & tables may get added to previous migrations. TODO: fix that using a black-list
	 *
	 * @param  array  $options
	 * @return void
	 */
	private function generate_migration($options){

		if (isset($options['name'])){ // support the legacy usage of this call

			$options['migrationName'] = $options['name'];
			unset($options['name']);
		}

		$this->call('generate:migration', $options);
		$this->call('migrate'); // see comments
	}

	private function generate_migrations($panels){

		foreach($panels as $panel)
        {
			$data			= StationConfig::panel($panel, TRUE);
			$table_name		= $data['panel_options']['table'];

			if (!isset($data['panel_options']['table'])) continue;

			$fields_string	= $this->fields_string_for_elements($table_name, $data);

        	if (Schema::hasTable($table_name)){

        		foreach($data['elements'] as $att_name => $att_data){
        			
        			if (!Schema::hasColumn($table_name, $att_name) // we don't have column,
        				&& !isset($att_data['data']['pivot']) // and it's not a PIVOT join
        				&& $att_data['type'] != 'subpanel'  // and it's not a sub panel element type
        				&& $att_data['type'] != 'virtual') { // and it's not a virtual element type

        				// ... add migration for it.
        				$migration_name = 'add_'.$att_name.'_column_to_'.$table_name.'_table'; // must keep 'column_to'!
        				$migration_options = array('name' => $migration_name,'--fields' => $att_name.$this->column_type_suffix($att_data));
        				$this->generate_migration($migration_options);
        			}

        			if ($att_data['type'] == 'subpanel'  // we have a sub panel 
        				&& isset($att_data['data']['table']) // with a table 
        				&& isset($att_data['data']['key']) // and a key referenced
        				&& !Schema::hasColumn($att_data['data']['table'], $att_data['data']['key'])){ // but no column in table

        				// ... add migration for it.
        				$subpanel_data = StationConfig::panel($att_name, TRUE);
        				$subpanel_fields_string	= $this->fields_string_for_elements($att_data['data']['table'], $subpanel_data);
        				if (!Schema::hasTable($att_data['data']['table'])) $this->table_migrate($att_data['data']['table'], $subpanel_fields_string);
        				$migration_name = 'add_'.$att_data['data']['key'].'_column_to_'.$att_data['data']['table'].'_table'; // must keep 'column_to'!
        				$migration_options = array('name' => $migration_name,'--fields' => $att_data['data']['key'].':integer');
        				$this->generate_migration($migration_options);
        			}
        		}

        	} else if ($fields_string != '') { // we don't have this table, but we have fields so, let's create it

        		$this->table_migrate($table_name, $fields_string);
        	}


        	$this->migration_for_reorderable_panel($data, $table_name);
        	$this->migration_for_nestable_panel($data, $table_name);
        }

        $this->generate_pivots();

        if (!Schema::hasTable('password_reminders')) {
        	
        	$this->call('auth:reminders-table'); // this is needed for using auth. 
        	$this->call('auth:reminders-controller'); // this is needed for using auth. 
        }

        return TRUE;
	}

	/**
	 * generates and saves any models that are needed. It ignores User and Group panels.
	 * 
	 * TODO: rewrite this.
	 *
	 * @param  none
	 * @return void
	 */
	private function generate_models($panels){

		$this->file = new File;
		$this->panel_model = new Panel;

		foreach($panels as $panel_name)
		{
			if(in_array($panel_name, array('users','groups'))) continue; // Skipping over these

			$station_config	= new StationConfig;
			$panel_data		= $station_config::panel($panel_name, TRUE);
			$className		= $panel_data['panel_options']['single_item_name'];
			$modelName		= $this->panel_model->model_name_for($panel_name);
			$tableName		= $panel_data['panel_options']['table'];
			$filePath		= app_path() . '/models/'.$modelName.'.php';

			if($this->file->exists($filePath))	// we are just going to rebuild the section that is generated
			{
				$new_model		= $this->model_code(FALSE, $modelName, $tableName, $panel_data);
				$existing_model	= $this->file->get($filePath);
				$start			= explode($this->gen_begin,$existing_model);
				$end			= explode($this->gen_end,$start[1]);
				$new_model		= $start[0].$new_model.$end[1];
			}
			else 	// totally new model to write!
			{
				$new_model 		= $this->model_code(TRUE, $modelName, $tableName, $panel_data);
			}

			$this->file->put($filePath,$new_model);
			$this->model_output[] = $modelName;

		}
	}

	/**
	 * fire generate:pivot for any pivot tables that we need which do not already exist.
	 *
	 * @return void
	 */
	private function generate_pivots(){

        if(count($this->pivot)>0)
        {
        	foreach($this->pivot as $pivot)
        	{
        		$pivot_table_name = $this->pivot_table_name($pivot);

        		if (!Schema::hasTable($pivot_table_name)) {

        			$this->call('generate:pivot',$pivot);
        		}
        		$this->call('migrate');
        	}
        }
	}

	/**
	 * let's see if this panel is nestable and make sure we have a columns to support it!
	 * then run the migration generator
	 *
	 * @param  array  $data  // panel data
	 * @param  string $table_name 
	 * @return void
	 */
	private function migration_for_nestable_panel($data, $table_name){

        $is_nestable_panel 	= isset($data['panel_options']['nestable_by']) && $data['panel_options']['nestable_by'];

        if ($is_nestable_panel){

        	$panel 				= new Panel;
	        $default_columns 	= $panel->nestable_default_columns;
	        $i 					= 0;

	        foreach ($default_columns as $default_column) {
	        	
	        	$column = isset($data['panel_options']['nestable_by'][$i]) ? $data['panel_options']['nestable_by'][$i] : $default_column;

	        	if ($is_nestable_panel && !Schema::hasColumn($table_name, $column)){

		        	$migration_name = 'add_'.$column.'_column_to_'.$table_name.'_table'; // must keep 'column_to'!
		        	$migration_options = array('name' => $migration_name,'--fields' => $column.':integer:default("0")');
		        	$this->generate_migration($migration_options);
		        }

		        $i++;
	        }
	    }
	}

	/**
	 * let's see if this panel is reorderable and make sure we have a column to reorder it by!
	 * then run the migration generator
	 *
	 * @param  array  $data  // panel data
	 * @param  string $table_name 
	 * @return void
	 */
	private function migration_for_reorderable_panel($data, $table_name){

        $is_reorderable_panel = isset($data['panel_options']['reorderable_by']) && $data['panel_options']['reorderable_by'];
        $reorderable_column = $is_reorderable_panel ? $data['panel_options']['reorderable_by'] : FALSE;

        if ($is_reorderable_panel && !Schema::hasColumn($table_name, $reorderable_column)){

        	$migration_name = 'add_'.$reorderable_column.'_column_to_'.$table_name.'_table'; // must keep 'column_to'!
        	$migration_options = array('name' => $migration_name,'--fields' => $reorderable_column.':integer:default("0")');
        	$this->generate_migration($migration_options);
        }
	}

	private function model_code($is_new = FALSE, $modelName, $tableName, $panel_data){

		$panel  = new Panel;

		$code 	= "";
		$code	.= $is_new ? "<?php\n\n"
				. "class $modelName extends Eloquent {\n\t" : "";

		$code	.= $this->gen_begin."\n\n\t"
				. "protected \$table = '$tableName';\n\tprotected \$guarded = array('id');\n\n";

		$code 	.= !$panel_data['panel_options']['has_timestamps'] ? "\tpublic \$timestamps = false;\n\n" : "\n";
		
		if (isset($panel_data['elements'])){

			foreach($panel_data['elements'] as $elem_name => $elem_data)
			{
				if(isset($elem_data['data']['relation']) 
					&& in_array($elem_data['data']['relation'], $this->valid_relationships)
					&& !isset($elem_data['data']['no_model']))
				{	
					$is_subpanel 	= $elem_data['type'] == 'subpanel';
					$order_by		= '';

					if ($is_subpanel){ // check to see if we can apply order_by clause for foreign table relationship.

						$subpanel_data		= StationConfig::panel($elem_name, TRUE);
						$order_by_column	= isset($subpanel_data['panel_options']['default_order_by']) ? $subpanel_data['panel_options']['default_order_by'] : false;
						$order_by			= $order_by_column ? $this->order_by_clause($order_by_column) : "";
					
					} else {

						// TODO: add order_by for non sub panels. We will need this soon.
					}

					$pivot_table_name 	= $this->pivot_table_name(array('tableOne' => $tableName, 'tableTwo' => $elem_data['data']['table']), TRUE);
					$pivot_table 		= strpos($elem_data['data']['relation'], 'ToMany') !== FALSE ? $pivot_table_name : '';
					$pivot_table 		= $pivot_table == "" && $elem_data['data']['relation'] == 'belongsTo' ? ", '".$elem_name."'" : $pivot_table;
					$pivot_table 		= $pivot_table == "" && $elem_data['data']['relation'] == 'hasMany' && isset($elem_data['data']['key']) ? ", '".$elem_data['data']['key']."'" : $pivot_table;
					$code 				.= "\tpublic function ".$elem_data['data']['table']."()\n\t"
										. "{\n\t\t"
										. "return \$this->".$elem_data['data']['relation']
										. "('".$panel->model_name_for($elem_data['data']['table'])."'".$pivot_table.")".$order_by.";\n\t"
										. "}\n";
				}
			}
		}

		$code .= "\t".$this->gen_end;
		$code .= $is_new ? "\n\n\t// Feel free to add any new code after this line\n}" : "";

		return $code;
	}

	private function order_by_clause($str){

		$ret = '';

		foreach (explode(',', $str) as $part) {
			
			$part_arr	= explode(' ', $part);
			$direction	= isset($part_arr[1]) ? ", '".strtolower($part_arr[1])."'" : "";
			$ret		.= "->orderBy('".$part_arr[0]."'".$direction.")";
		}

		return $ret;
	}

	/**
	 * the pivot table name.
	 * makes compound table name from singular versions of foreign table names
	 *
	 * @param  array  $pivot // consists of the foreign table names
	 * @return string
	 */
	private function pivot_table_name($pivot, $with_keys = FALSE){

        $tableOne 	= str_singular($pivot['tableOne']);
        $tableTwo 	= str_singular($pivot['tableTwo']);
        $tables 	= array($tableOne, $tableTwo);

        sort($tables);

        if ($with_keys) {
        	
        	return ", '".$tables[0]."_".$tables[1]."', '".str_singular($tableOne)."_id', '".str_singular($tableTwo)."_id'";

        } else {

        	return $tables[0].'_'.$tables[1];
        }
	}

	private function print_output()
	{
		$the_output = "The following models were created:\n";

		foreach($this->model_output as $model)
		{
			$the_output .= $model."\n";
		}

		$the_output .= "artisan dump-autoload ran!\n";

		return $the_output;
	}

	/**
	 * converts panel element to a string which can be passed to way's generate:migration
	 *
	 * @param  string  $table_name  // table name
	 * @param  string  $name // element name
	 * @param  array  $data // element config data
	 * @return string // empty if we need a pivot on this element
	 */
	private function process_element($table_name,$name,$data)
	{
		if ($data['type'] == 'virtual') return '';

		$ret = $name;

		// add a pivot if join is required
		// TODO: extract this
		if(isset($data['data']['join']) && $data['data']['join'] && isset($data['data']['pivot']) && $data['data']['pivot'])
		{
			$this->pivot[] = array('tableOne'=>$table_name,'tableTwo'=>$data['data']['pivot']);
			return '';
		}
		elseif(isset($data['data']['join']) && !$data['data']['join']) return '';
		
		$ret .= $this->column_type_suffix($data);

		if(isset($data['length'])) $ret .= '('.$data['length'].')';

		if(isset($data['attributes']) && $data['attributes'] != '')
		{
			$attribs = explode('|', $data['attributes']);

			foreach($attribs as $attribute)
			{
				if($attribute!='')	$ret .= ':'.$attribute;
			}
		}

		return $ret.', ';
	}

	private function table_migrate($table_name, $fields_string){

		$migration_options = array('migrationName' => 'create_'.$table_name.'_table','--fields' => $fields_string);
        $this->generate_migration($migration_options);
	}
}
