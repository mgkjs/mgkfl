/*

Responsive Mobile 
Plugin URI: mangaku.web.id

Author: Fandy


License: http://mangaku.web.id

*/
/*
jQuery(document).ready(function($){
$('body').prepend('<a href="#" class="back-to-top">Back to Top</a>');
    $(window).scroll(function(){
        if ($(this).scrollTop() > 550) {
            $('a.back-to-top').fadeIn('slow');
        } else {
            $('a.back-to-top').fadeOut('slow');
        }
    });
    $('a.back-to-top, a.simple-back-to-top').click(function(){
        $("html, body").animate({ scrollTop: 0 }, 500);
        //$("html, body").scrollTop(0); //For without animation
        return false;
    });
});
*/
function sticky_relocate() {
    var window_top = $(window).scrollTop();
    var div_top = $('#sticky-anchor').offset().top;
    if (window_top > div_top) {
        $('#sticky').addClass('stick');
        $('#sticky-anchor').height($('#sticky').outerHeight());
    } else {
        $('#sticky').removeClass('stick');
        $('#sticky-anchor').height(0);
    }
}

$(function() {
    $(window).scroll(sticky_relocate);
    sticky_relocate();
});

var dir = 1;
var MIN_TOP = 200;
var MAX_TOP = 350;

function autoscroll() {
    var window_top = $(window).scrollTop() + dir;
    if (window_top >= MAX_TOP) {
        window_top = MAX_TOP;
        dir = -1;
    } else if (window_top <= MIN_TOP) {
        window_top = MIN_TOP;
        dir = 1;
    }
    $(window).scrollTop(window_top);
    window.setTimeout(autoscroll, 100);
}
function tabview_aux(TabViewId, id)
{
  var TabView = document.getElementById(TabViewId);

  // ----- Tabs -----

  var Tabs = TabView.firstChild;
  while (Tabs.className != "Tabs" ) Tabs = Tabs.nextSibling;

  var Tab = Tabs.firstChild;
  var i   = 0;

  do
  {
    if (Tab.tagName == "A")
    {
      i++;
      Tab.href      = "javascript:tabview_switch('"+TabViewId+"', "+i+");";
      Tab.className = (i == id) ? "Active" : "";
      Tab.blur();
    }
  }
  while (Tab = Tab.nextSibling);

  // ----- Pages -----

  var Pages = TabView.firstChild;
  while (Pages.className != 'Pages') Pages = Pages.nextSibling;

  var Page = Pages.firstChild;
  var i    = 0;

  do
  {
    if (Page.className == 'Page')
    {
      i++;
      if (Pages.offsetHeight) Page.style.height = (Pages.offsetHeight-2)+"px";
      Page.style.overflow = "auto";
      Page.style.display  = (i == id) ? 'block' : 'none';
    }
  }
  while (Page = Page.nextSibling);
}


// ----- Functions -------------------------------------------------------------

function tabview_switch(TabViewId, id) { tabview_aux(TabViewId, id); }

function tabview_initialize(TabViewId) { tabview_aux(TabViewId,  1); }


$(document).ready(function(){
    $('.sendButton').attr('disabled',true);
    $('#message').keyup(function(){
        if($(this).val().length !=0)
            $('.sendButton').attr('disabled', false);            
        else
            $('.sendButton').attr('disabled',true);
    })
});
