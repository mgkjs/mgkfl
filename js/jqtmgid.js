(function (factory) {
  if (typeof define === 'function' && define.amd) {
    define(['jquery'], factory);
  } else if (typeof module === 'object' && typeof module.exports === 'object') {
    factory(require('jquery'));
  } else {
    factory(jQuery);
  }
}(function (jQuery) {
  // Indonesian
 
  jQuery.timeago.settings.strings = {
	//allowFuture = true,
    prefixAgo: '',
    prefixFromNow: '',
    suffixAgo: "",
    suffixFromNow: "dari sekarang",
    seconds: "Baru saja",
    minute: "1 menit lalu",
    minutes: "%d menit lalu",
    hour: "1 jam lalu",
    hours: "%d jam lalu",
    day: "Kemarin",
    days: "%d hari lalu",
    month: "1 bulan lalu",
    months: "%d bulan lalu",
    year: "1 tahun lalu",
    years: "%d tahun lalu"
  };
}));

