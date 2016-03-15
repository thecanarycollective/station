<nav class="navbar navbar-default" role="navigation" style="display: none;">
  <div class="container">
    <!-- Brand and toggle get grouped for better mobile display -->
    <div class="navbar-header">
      <button type="button" class="navbar-toggle" data-toggle="collapse" data-target="#bs-example-navbar-collapse-1">
         <span class="sr-only">Toggle navigation</span>
         <span class="icon-bar"></span>
         <span class="icon-bar"></span>
         <span class="icon-bar"></span>
      </button>
       <a class="navbar-brand" href="/{{ $app_data['root_uri_segment'] }}">{{ $app_data['name'] }}</a>
    </div>
  
    <!-- Collect the nav links, forms, and other content for toggling -->
    <div class="collapse navbar-collapse" id="bs-example-navbar-collapse-1">
    
      <!--
      <form class="navbar-form navbar-right" action="javascript:;">
        <div class="form-group">
          <div class="input-group input-group-sm">
            <input class="form-control" id="navbarInput-02" type="search" placeholder="Search" autocomplete="off" />
            <span class="input-group-btn">
              <button type="submit" class="btn"><span class="fui-search"></span></button>
            </span>            
          </div>
        </div>                                    
      </form>
      -->
  
      <ul class="nav navbar-nav navbar-right">
          <li class="dropdown">
              <a href="/{{ $app_data['root_uri_segment'] }}/panel/my_account/update/{{ $user_data['id'] }}">
                <img class="gravatar" src="https://www.gravatar.com/avatar/{{ $user_data['gravatar_hash'] }}?s=30&d=identicon">&nbsp; 
                {{ $user_data['name'] }}
              </a>
              <a href="/{{ $app_data['root_uri_segment'] }}/logout/">Log-out Of Account</a>
          </li>
      </ul>
    </div><!-- /.navbar-collapse -->
  </div>
</nav>