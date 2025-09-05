var eigenschappen {};
eigenschappen.lengte = 100;
eigenschappen.breedte = 50;

var forumle = "lengte * breedte";

forumle.replace("lengte", eigenschappen.lengte);
forumle.replace("breedte", eigenschappen.breedte);


eval(formule);