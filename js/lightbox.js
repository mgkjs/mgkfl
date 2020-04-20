(function($) {
 
    // Initialize the Lightbox for any links with the 'fancybox' class

 
    // Initialize the Lightbox automatically for any links to images with extensions .jpg, .jpeg, .png or .gif
    $(".post .separator a[href$='.jpg'], .post .separator a[href$='.png'], .post .separator a[href$='.jpeg'], .post .separator a[href$='.gif']").fancybox({
        maxWidth        : 800,
        maxHeight       : 600,
        fitToView       : true,
        width           : '70%',
        height          : '70%',
        autoSize        : true,
        closeClick      : true,




	});
    // Initialize the Lightbox and add rel="gallery" to all gallery images when the gallery is set up using [gallery link="file"] so that a Lightbox Gallery exists
    $(".gallery a[href$='.jpg'], .gallery a[href$='.png'], .gallery a[href$='.jpeg'], .gallery a[href$='.gif']").attr('rel','gallery').fancybox();
 
    // Initalize the Lightbox for any links with the 'video' class and provide improved video embed support
    $(".video").fancybox({
        maxWidth        : 800,
        maxHeight       : 600,
        fitToView       : true,
        width           : '70%',
        height          : '70%',
        autoSize        : true,
        closeClick      : true,
        openEffect      : 'none',
        closeEffect     : 'none'
    });
 
})(jQuery);