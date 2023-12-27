// Main Variables
var app = {
	version:"0.3.0",
	mouseDown:false, // When pointer is down on page
	titleClicks:0,
	devmode:false, // On PC, true, on android device, false
	loadedTranslations:[], // List of loaded translations
	netJsonData:"", // JSON data from the current page (NET)
	doneLoadingJSON:false, // When done loading JSON from NET
	netTextData:"", // Text data from current page (NET)
	numberThingy:0, // I have no idea
	loadedScript:false, // When 
	loadedScriptData:"", // When the VOTD has loaded
	connectivity:"", // Online or Offline HTML element
	sidebarTouch:false,
	language:english,
	configuration:"", // Config file loaded from filesystem to RAM
	lastTranslation:"", // The translation before switching
	status:"", // Offline/Online
	lastBook:"", // Last book before switching
	done:false, // When everthing is done with bible data.
	usingDownloadedTranslation:"false", // If using downloaded translation
	highlightedVerses:{
		"John 3 16": "yellow",
		"Hebrews 4 12": "lightgreen",
		"Luke 9 23": "lightgreen"
	},
	bookmarkedChapters:[
		"Hebrews 4",
		"John 3"
	],
	jsonpReturnFunction:""
};

// Current things (loaded from config file)
var current = {
	verse:0,
	font:"Arial",
	language:"english",
	bookNumber:57,
	theme:"default",
	verse:"",
	translation:"", // Current translation, all in JSON
	translationString:"KJV2000", // Current translation name
	translationStringHuman:"KJV 2000", // Current translation name, but more readable for humans
	fontSize:18,
	book:"",
	chapter:""
}

var downloadedTranslationsObj = {};
var data; // Config file data

// When the page loads
window.onload = function() {

	console.log("Welcome to Heb12 Mobile v" + app.version + ". Type help() for some cool stuff.")

	// Fill the selects
	for (var i = 0; i < books.length; i++) {
		document.getElementById('book').innerHTML += "<option eng='" + books[i] + "'>" + books[i] + "</option>";
	}

	for (var i = 1; i <= 55; i++) {
		document.getElementById('chapter').innerHTML += "<option>" + i + "</option>";
	}

	// Set app.devmode to false if not messing with app
	if (!window.location.href.includes("?")) {
		app.devmode = true;
	} else {
		app.devmode = false;
	}

	// Do some things if the viewer is on safari on iOS (Apple is poopoo)
	if (/iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream) {
		app.devmode = true;
	}

	// Load settings and translations to RAM
	if (!app.devmode) {
		
		// Load offline downloaded translations
		var downloadedTranslations = interface.exec("gettranslations", "");

		// Wait until Java has finished getting the translations downloaded (just names, not actual data)
		var waitForReturn = setInterval(function() {
			if (typeof downloadedTranslations !== "undefined") {
				var bibles = downloadedTranslations.split(",");
				for (var i = 0; i < bibles.length; i++) {
					if (downloadedTranslations !== "") {
						var string = bibles[i].replace(".js", "").split("_")
						var lang = string[0];
						var tran = string[1];

						createTranslation(lang, tran);
						downloadedTranslationsObj[lang + "_" + tran] = "true";
					}
				}
				clearInterval(waitForReturn);
			}
		}, 1);

		// Open data and parse it (yes, through the URL)
		data = window.location.href.split("?")[1];
		data = data.replace(/%22/g, '"');
		data = data.replace(/%20/g, " ");
		
		// This handy Regex parses the JS object without executing it (older versions didn't have pure json)
		var regex = /\[\"(false|true)\"[,]((.)+)[\]]/gm;
		newData = regex.exec(data);

		// It is split into 4 parts, but [1] and 2 are only needed
		var firstTime;
		var configuration;

		// Detect if new user (avoid parsing object)
		if (data == '["true"]') {
			firstTime = "true";
		} else {
			var firstTime = newData[1];
			var configuration = newData[2];
		}


		// If loading the app for the first time.
		// Create default configuration file. if else, try to convert old one
		if (firstTime == "true") {
			configuration = JSON.parse(updateConfigFile("def")) // set config to default
			setTimeout(function() {
				// Wait for whatever to load before showing popup... Not sure why it does this
				notify("firsttime");
			}, 1000)
		} else {
			configuration = convert(configuration);
		}

		// Parse Data
		current.theme = configuration.theme;
		current.font = configuration.font;
		current.fontSize = Number(configuration.fontSize);
		current.book = configuration.lastBook;
		current.chapter = configuration.lastChapter;
		current.translationString = configuration.currentTranslation;
		app.highlightedVerses = configuration.highlightedVerses;
		app.bookmarkedChapters = configuration.bookmarkedChapters;

		// Update UI
		document.getElementById('page').style.fontSize = current.fontSize + "px";
		document.getElementById('page').style.lineHeight = (current.fontSize + 7) + "px";
		document.getElementById('page').style.fontFamily = current.font;
		setTheme(configuration.theme);

		current.book = configuration.lastBook;
		current.chapter = configuration.lastChapter;
	}

	// Use method start app when the first bible loads (Not accurate on <=5.1)
	var waitUntilLoad = setInterval(function() {
		if (typeof window[current.translationString.toLowerCase()] !== "undefined") {
			if (app.devmode) {
				document.getElementById('page').innerHTML = load("Hebrews", "4");
			} else {
				document.getElementById('page').innerHTML = load(current.book, current.chapter);
			}

			update();
			clearInterval(waitUntilLoad);
		}
	}, 10);

	loadVOTD();

	updateTranslation();
	updateLanguage();

	// Detect keypresses
	document.body.onkeydown = function(event) {
		if (event.key == "ArrowRight") {
			update("next");
		} else if (event.key == "ArrowLeft") {
			update("previous");
		}
	}
}

// Load Bible content to screen
function load(book, chapter, verse) {
	var breaks = "<br>".repeat(app.breaksAfterVerse);

	updateBookNumber(book);

	// Prevent chapter being smaller than
	if (bible[current.bookNumber][1] < chapter) {
		chapter = bible[current.bookNumber][1];
	}

	// Check if using downloaded translation
	app.usingDownloadedTranslation = "false";
	var it = document.getElementById('translation');
	var val = it.options[it.selectedIndex].getAttribute("val");
	var downloaded = it.options[it.selectedIndex].getAttribute("downloaded");
	app.usingDownloadedTranslation = downloaded;

	// Set the select elements
	updateChapters(book);
	document.getElementById('book').children[current.bookNumber].selected = true;
	document.getElementById('chapter').value = chapter;

	// Openbibles Parser
	if (isOpenbibles()) {

		// 1 Chapter books
		var verses;
		if (!current.translation.osis.osisText.div[current.bookNumber].chapter.verse) {
			verses = current.translation.osis.osisText.div[current.bookNumber].chapter[chapter - 1].verse;
		} else {
			document.getElementById('chapter').innerHTML = "<option>1</option>"; // Why the heck is this here
			verses = current.translation.osis.osisText.div[current.bookNumber].chapter.verse;
		}

		// Add html to verses or return just a verse
		var page = "";
		if (!isNaN(verse)) {
			if (app.usingDownloadedTranslation == "true") {
				page = verses[verse][1];
			} else {
				page = verses[verse].text;
			}
		} else {
			for (var i = 0; i < verses.length; i++) {
				if (app.usingDownloadedTranslation == "true") {
					page += modifyVerse(i + 1, verses[i][1]);
				} else {
					page += modifyVerse(i + 1, verses[i].text);
				}
			}
		}

		page = page.replace(/\[/g, "");
		page = page.replace(/\]/g, "");

		return page;
	} else if (current.translationString == "netOnline") {

		// Net Online doesn't like number thingies
		book = book.replace("st", "");
		book = book.replace("nd", "");
		book = book.replace("rd", "");

		var url;
		if (!isNaN(verse)) {
			url = "http://labs.bible.org/api/?passage=" + book + " " + chapter + ":" + verse + "&type=json&callback=getScript";
		} else {
			url = "http://labs.bible.org/api/?passage=" + book + " " + chapter + "&type=json&callback=getScript&&formatting=full";
		}

		// Load NET data
		loadJSONP(url, function(data) {
			var finaldata = "";
			if (isNaN(verse)) {
				for (var i = 0; i < data.length; i++) {
					if (!(!data[i].title)) {
						finaldata += "<h3>" + data[i].title + "</h3>";
					}

					// Modify NET data for better reading
					var modifiedVerse = data[i].text.replace(/<\/?(st)("[^"]*"|'[^']*'|[^>])*(>|$)/gm, "");
					modifiedVerse = modifiedVerse.replace(/<p class="bodytext">/g, "");
					modifiedVerse = modifiedVerse.replace(/<p class="otpoetry">/g, "<br>");
					modifiedVerse = modifiedVerse.replace(/id="verse"/g, 'class="verseStart"');
					finaldata += modifyVerse(i, modifiedVerse);
				}
			} else {
				finaldata = data[0].text;
			}

			app.doneLoadingJSON = true;
			app.netTextData = finaldata;
		})
	}
}

// Visit a random chapter
function random() {
	var randomBook = books[Math.floor(Math.random() * books.length)];
	var randomChapter = Math.floor(Math.random() * bibleObj[randomBook]);
	if (randomChapter == 0) {
		randomChapter = 1;
	}

	document.getElementById('page').innerHTML = load(randomBook, randomChapter);
	update();
	animateIt("sidebar", "close");
}

// Function to handle page updates (runs after load)
function update(option) {
	var book = document.getElementById('book');
	book = book.options[book.selectedIndex].getAttribute("eng");

	var chapter = document.getElementById('chapter').value;
	updateTranslation();

	// If the user goes back at the first chapter of a book, go back to the previous book
	if (option == "next") {
		animateIt("sidebar", "close");
		if (bible[current.bookNumber][1] == document.getElementById('chapter').value) {
			if (book == "Revelation" && chapter == 22) {
				book = "Genesis";
				chapter = 1;
			} else {
				book = books[current.bookNumber + 1];
				chapter = 1;
			}
		} else {
			chapter++;
			if (bible[current.bookNumber][1] <= chapter) {
				chapter = bible[current.bookNumber][1];
			}
		}

	} else if (option == "previous") {
		animateIt("sidebar", "close");
		if (book == "Genesis" && chapter == 1) {
				book = "Revelation";
				chapter = 22;
		} else if (chapter !== "1") {
			chapter--;
		} else {
			book = books[current.bookNumber - 1];
			chapter = bible[current.bookNumber - 1][1];
		}
	}

	// Prevent chapter being bigger than book length
	if (bible[current.bookNumber][1] <= chapter) {
		chapter = bible[current.bookNumber][1];
	}

	// Get offline data
	if (current.translationString == "netOnline") {
		load(book, chapter);
		var int = setInterval(function() {
			if (app.doneLoadingJSON) {
				document.getElementById('page').innerHTML = app.netTextData;
				postLoad(current.verse);
				app.doneLoadingJSON = false;
				clearInterval(int);
			}
		},1);
	} else {
		var waitUntilLoad = setInterval(function() {
			if (eval('typeof ' + current.translationString.toLowerCase() + ' !== "undefined"')) {
				current.translation = eval(current.translationString.toLowerCase());
				document.getElementById('page').innerHTML = load(book, chapter);
				postLoad(current.verse);
				clearInterval(waitUntilLoad);
			}
		},10);
	}

	// Update the configuration file
	if (!app.devmode) {
		updateConfigFile();
	}

	// Update book number
	updateBookNumber(book);

	// Set current book and chapter to the calculated one
	current.book = book;
	current.chapter = chapter;

	// If bookmarkedChapters includes the current chapter, then set the icon to filled
	var marked = app.bookmarkedChapters.includes(book + " " + chapter);
	if (marked == true || !(!marked)) {
		document.getElementById('bookmark').src = "images/bookmarked.svg";
	} else {
		document.getElementById('bookmark').src = "images/notbookmarked.svg"
	}
}

// Update the current translation (beware of bad code)
function updateTranslation() {
	var translation = document.getElementById('translation');

	if (translation.value == "Download more translations") {
		document.getElementById('translation').value = app.lastTranslation;
		animateIt("sidebar", "close")
		notify("download");
	} else {
		app.lastTranslation = translation.value;
	}

	// Check if the app using a translation not built in
	var val = translation.options[translation.selectedIndex].getAttribute("val");
	var downloaded = translation.options[translation.selectedIndex].getAttribute("downloaded");
	app.usingDownloadedTranslation = downloaded;

	// Set current translation
	if (!translation.value.startsWith("NET")) {
		current.translationString = val;
	} else {
		current.translationString = "netOnline";
	}

	// Set more readable translation string
	if (translation.value.startsWith("NET")) {
		current.translationStringHuman = "Online NET";
	} else {
		// Add space between letters and numbers (KJV2000) > (KJV 2000)
		var formatted = val.match(/[0-9]+/g);
		val = val.replace(formatted, " " + formatted);
		
		current.translationStringHuman = val;
	}

	// Only load the script if it hasn't loaded yet
	if (!(!app.loadedTranslations.indexOf(current.translationString.toLowerCase())) && downloaded !== "true") {
		var script = document.createElement("script");
	    script.src = "bibles/" + current.translationString.toLowerCase() + ".js";
	    script.type = "text/javascript";
	    script.id = current.translationString.toLowerCase() + "Script";

		if (current.translationString !== "netOnline") {
			document.getElementById('loadedScripts').appendChild(script);
		}

		app.loadedTranslations.push(current.translationString.toLowerCase());

		script.onload = function() {
			current.translation = eval(current.translationString.toLowerCase());
		}
	} else if (typeof window[val] === "undefined" && downloaded == "true") {
		if (!app.devmode) {
			var thing = document.getElementById('translation');
			var name = thing.children[thing.selectedIndex].getAttribute("val");
			window[name] = JSON.parse(interface.exec("gettranslationdata", name + ".js"));
			current.translation = window[name];
		}
	} else {
		if (current.translationString !== "netOnline") {
			current.translation = window[current.translationString.toLowerCase()];
		}
	}
}

function search(thing) {
	notify("browserselect", thing);
}

// Update the configuration file or return the default
function updateConfigFile(def) {
	var config = {};

	// Name, value, default value
	var options = [
		["currentTranslation", current.translationString, "KJV2000"],
		["lastBook", document.getElementById('book').value, "Hebrews"],
		["lastChapter", document.getElementById('chapter').value, "12"],
		["theme", current.theme, "default"],
		["font", current.font, "arial"],
		["highlightedVerses", app.highlightedVerses, {"John 3 16": "yellow", "Hebrews 4 12": "lightgreen", "Luke 9 23": "lightgreen"}],
		["fontSize", current.fontSize, "18"],
		["bookmarkedChapters", app.bookmarkedChapters, ["Hebrews 4", "John 3"]]
	];

	// Determine which part to use, the current app var (1), or the default (2)
	var val = 1;
	if (def) {
		val = 2;
	}

	for (var i = 0; i < options.length; i++) {
		config[options[i][0]] = options[i][val];
	}

	var result = JSON.stringify(config);

	interface.exec("write", result);
	return result
}

// Set current theme
function setTheme(theme) {
	// Load the CSS file
	document.getElementById('loadedCSS').innerHTML = '<link rel="stylesheet" type="text/css" href="themes/' + theme + '.css">';

	current.theme = theme;
	animateIt("sidebar", "close");
	animateIt("popup", "close");
	update();
}

function setFont(font) {
	document.getElementById('page').style.fontFamily = font;
	document.getElementById('fontPreview').style.fontFamily = font;
	current.font = font;
	
	update();
}

// Update the search bar or go to the chapter. searching = ""/"visit"
function updateSearch(searching) {
	var term = document.getElementById('search').value;
	var result = document.getElementById('searchResults');
	if (result.value == "") {
		result.style.display = "none";
	} else {
		result.style.display = "block";
	}

	// REGEXP to recongnise books and chapters
	var validateChapter = /[ ]*([a-zA-z0-9 ]+)[: ;-]+([0-9]+)[ ]*/gm;
	var validateChapterAndVerse = /[ ]*([a-zA-z0-9 ]+)[: ;-]+([0-9]+)[: ;-]+([0-9]+)*[ ]*/gm;
	var book;
	var chapter;
	var verse = "";
	var valid = [true];

	// Check if using chapter+verse, or just chapter
	if (validateChapterAndVerse.test(term)) {
		// Using chapter and verse
		book = term.replace(validateChapterAndVerse, "$1");
		chapter = term.replace(validateChapterAndVerse, "$2");
		verse = term.replace(validateChapterAndVerse, "$3")
	} else if (validateChapter.test(term)) {
		// Using just chapter
		book = term.replace(validateChapter, "$1");
		chapter = term.replace(validateChapter, "$2");
	} else {
		valid = [false];
	}

	// Spell check + chapter verification
	if (valid[0]) {
		book = editBook(book, 1);
	}
	if (typeof book === "string") {
		valid = validChapter(book, chapter);
	}

	// Add : if not already there
	var verseStuff = "";
	if (!verse == "") {
		verseStuff = ":" + verse;
	}

	if (valid[0]) {
		result.innerHTML = "<span style='color:green;'>" + valid[1] + " " + chapter + verseStuff + "</span>";
	} else {
		result.innerHTML = "<span style='color:red;'>Not found</span>";
	}

	// If user is searching something
	if (searching == "visit") {
		// If valid, then close everything and go to the chapter
		if (!term == "" && valid[0]) {
			animateIt("sidebar", "close");
			goToChapter(valid[1], chapter);
			updateChapters(valid[1]);
			result.style.display = "none";
			document.getElementById('search').value = "";
			update();

			if (!verse == "") {
				current.verse = verse; // Wait until page loaded
			}
		}
	}

	// haha i'm bored
	switch (term.toLowerCase()) {
		case "hello":
		case "hi":
		case "Hello":
		case "Hi":
			result.innerHTML = "<span style='color:green;'>Hello!</span>";
			break;
	}
}

// Use like: validChapter("John", "1"); - There has to be a faster way of doing this... Oh well.
function validChapter(book, chapter) {
	for (var i = 0; i < books.length; i++) {
		var firstPart = editBook(book, 1);
		if (compareInsensitive(firstPart, books[i])) {
			if (bible[i][1] >= chapter) {
				return [true, books[i]];
			}
		}
	}
	return [false]
}

// Make Books easier to search
function editBook(book, part) {

	// Work with single digit numbers
	book = book.replace("1 ", "1st ");
	book = book.replace("3 ", "3rd ");
	book = book.replace("2 ", "2nd ");
	book = book.toUpperCase();
		
	// Fix common spelling mistakes
	var correct = [
	["Psalm", "Psalms"],
	["Timmothy", "Timothy"],
	["Jhon", "John"],
	["Dan", "Daniel"],
	["Esra", "Ezra"],
	["Thesolionions", "Thessalonians"],
	["Psalmss", "Psalms"]
	];

	for (var i = 0; i < correct.length; i++) {
		book = book.replace(correct[i][0].toUpperCase(), correct[i][1].toUpperCase());
	}

	return book
}

// Check if current translation is Openbibles
function isOpenbibles() {
	var type = current.translationString;
	var it = document.getElementById('translation');
	var downloaded = it.options[it.selectedIndex].getAttribute("downloaded");

	if (type == "KJV2000" || type == "ASV" || type == "DBY" || downloaded == "true") {
		return true;
	} else {
		return false;
	}
}

// Load JSONP from IFRAME (works offline)
function loadJSONP(url, returnCode) {
	app.loadedScript = false;
	app.jsonpReturnFunction = returnCode;

	var iframe = document.createElement("SCRIPT");
	iframe.src = url;
	iframe.id = "loadedScript" + app.numberThingy;
	iframe.type = "text/javascript";
	document.body.appendChild(iframe);

	iframe.onload = function() {
		app.loadedScript = true;
		iframe.outerHTML = "";
	}

	app.numberThingy++;
}

// JSONP callback function
function getScript(data) {
	app.loadedScriptData = data;
	app.jsonpReturnFunction(app.loadedScriptData);
}

// Modify a verse and check if it it highlighted
function modifyVerse(verseNum, verseText) {
	var book = document.getElementById('book').value;
	var chapter = document.getElementById('chapter').value;
	var color = "transparent";
	var textColor =  "color: ;'"
	if (isOpenbibles()) {
		verseNum--;
	}

	// Set text colors, not background
	var item = app.highlightedVerses[book + " " + chapter + " " + (Number(verseNum) + 1)];
	if (!(!item)) {
		color = item;
		if (current.theme == "dark" && item !== "transparent") {
			textColor = "color: black;'";
		}
		if (item == "transparent") {
			textcolor = "'";
		}
	}
	return "<span class='verse' onclick='versePopup(" + verseNum + ")'><b class='verseStart'>" + (verseNum + 1) + "</b> <span style='display: inherit;background: " + color + "; " + textColor + " class='verseText'>" + verseText + "</span></span>" + "<br>".repeat(app.breaksAfterVerse);
}

// Show verse menu
function versePopup(verse) {
	var book = document.getElementById('book').value;
	var chapter = document.getElementById('chapter').value;
	var theVerseText = book + " " + chapter + ":" + (verse + 1) + " (" + current.translationStringHuman + ")"; // Title of Popup
	document.getElementById('verseMenu').setAttribute("verse", book + " " + chapter + " " + (verse + 1)); // Set handy attributes

	animateIt("verseMenu", "show");

	// Change verse popup contents
	var mainContent = document.getElementById("mainContent");
	mainContent.getElementsByTagName("H2")[0].innerHTML = theVerseText;

	var theVerse;
	var done = false;

	// Get bible verse
	if (current.translationString == "netOnline") {
		load(book, chapter, verse + 1);
		var int = setInterval(function() {
			if (app.doneLoadingJSON) {
				theVerse = app.netTextData.replace('<a style="" target="_blank" href="http://netbible.com/net-bible-preface">&copy;NET</a>',"");
				done = true;
				clearInterval(int);
			}
		},1);
	} else if (isOpenbibles()) {
		theVerse = load(book, chapter, verse);
		app.doneLoadingJSON = true;
		done = true;
	} else {
		theVerse = load(book, chapter, verse + 1);
		app.doneLoadingJSON = true;
		done = true;
	}

	var entire;
	var wait = setInterval(function() {
		if (app.doneLoadingJSON && done) {
			current.verse = entire;

			mainContent.getElementsByTagName("SPAN")[0].innerHTML = theVerse;
			var verseMenu = document.getElementById("verseMenu").children[1];
			
			verseMenu.children[0].children[0].setAttribute("onclick", 'search("' + theVerseText + '")');
			verseMenu.children[1].children[0].setAttribute("onclick", "interface.exec('copy','" + theVerseText + " - " + theVerse + "')");
			verseMenu.children[2].children[0].setAttribute("onclick", "interface.exec('share','" + theVerseText + " - " + theVerse + "')");

			app.doneLoadingJSON = false;
			clearInterval(wait);
		}
	}, 10);
}

// Highlight a verse (called from HTML element)
function highlightVerse(elem) {
	var verse = elem.parentElement.parentElement.getAttribute("verse"); // Get current verse in popup
	var color = elem.getAttribute("class").split(" ")[1]; // Assigned color from CSS class

	// Make a custom color input
	if (color == "custom") {
		var color = document.createElement("INPUT");
		color.type = "color";
		color.value = "#FF0000";
		color.onchange = function() {
			app.highlightedVerses[verse.replace(/_/g, " ")] = color.value;

			update();
			animateIt("verseMenu", "close");
		}
		color.click();
	} else {
		app.highlightedVerses[verse.replace(/_/g, " ")] = color;

		update();
		animateIt("verseMenu", "close");
	}
}

function setFontSize(action) {
	if (action == "plus") {
		current.fontSize++
	} else {
		if (current.fontSize !== 5) {
			current.fontSize--
		}
	}

	// Update all elements
	document.getElementById('page').style.fontSize = current.fontSize + "px";
	document.getElementById('page').style.lineHeight = (current.fontSize + 7) + "px";
	document.getElementById('fontPreview').style.fontSize = current.fontSize + "px";
	document.getElementById('fontSizeSelect').innerHTML = current.fontSize;

	update();
}

// Load the number of chapters in book in chapter select
function updateChapters(book) {
	var bookNum = current.bookNumber;
	var chapterAmount = bible[bookNum][1];
	var chapterSelectLength = document.getElementById("chapter").options.length;

	// Avoid excess calling
	if (chapterSelectLength !== chapterAmount) {
		document.getElementById('chapter').innerHTML = "";
		for (var n = 1; n <= chapterAmount; n++) {
			document.getElementById('chapter').innerHTML += "<option>" + n + "</option>";
		}
	}
}

// A function that loads the VOTD, and puts it in the span
function loadVOTD() {
	loadJSONP("http://labs.bible.org/api/?passage=votd&type=json&callback=getScript", function(data) {
		data = data[0];
		var verse = data.text.replace('<a style="" target="_blank" href="http://netbible.com/net-bible-preface">&copy;NET</a>', "");
		var chapter = data.chapter;
		var book = data.bookname;
		var verseNum = data.verse;
		book = book.replace(/1/g, "1st");
		book = book.replace(/2/g, "2nd");
		book = book.replace(/3/g, "3rd");
		verse = "<a class='votdVerse' onclick='load(\"" + book + "\", " + chapter + "); update(); animateIt(\"sidebar\", \"close\"); current.verse = " + verseNum + "'><b>" + book + " " + chapter + ":" + app.loadedScriptData[0].verse + "</b></a> - " + verse;
		document.getElementById('votd').innerHTML = verse;
	});
}

function goToChapter(book, chapter, verse) {
	if (!typeof verse === "undefined") {
		scrollToVerse(verse);
	}
	load(book, chapter);
	update();
}

function bookmark() {
	var button = document.getElementById('bookmark');
	var ref = current.book + " " + current.chapter;
	var chapter = app.bookmarkedChapters.indexOf(ref);

	if (chapter == -1) { // Doesn't exist, yet, add it
		app.bookmarkedChapters.push(ref);
		button.src = "images/bookmarked.svg";
	} else {
		app.bookmarkedChapters.splice(chapter, 1); // Remove the ref
		button.src = "images/notbookmarked.svg";
	}

	update();
}

// A thing to set the user's language
function setLanguage(string) {
	current.language = string;
	updateLanguage();
	animateIt("popup", "close");
}

// Function to return downloaded translation
function returnTranslation(name, translationData) {
	window[name] = translationData; // Create global variable
}

function scrollToVerse(verse) {
	var elem = document.getElementsByClassName("verse")[Number(verse) - 1];
	elem.scrollIntoView();
}

function compareInsensitive(string1, string2) {
	if (string1.toUpperCase() == string2.toUpperCase()) {
		return true
	} else {
		return false
	}
}

// animateIt("sidebar", "show")
function animateIt(elementStr, visi) {
	var element = document.getElementById(elementStr).style;
	var animations = {
		sidebar: ["slideOut", "slideIn"],
		popup: ["hidePopup", "showPopup"],
		verseMenu: ["down", "up"]
	}

    // Hack to prevent verse popup from showing if sidebar is out
    if (elementStr == "verseMenu" && document.getElementById("sidebar").style.display == "block") {
        return;
    }

	if (visi == "close") {
		element.WebkitAnimationName = animations[elementStr][0];
		setTimeout(function() {
			element.display = "none";
		},475);
	} else if (visi == "show") {
		element.WebkitAnimationName = animations[elementStr][1];
		element.display = "block";
	}
}

// Update current book (and return it)
function updateBookNumber(book) {
	for (var i = 0; i < books.length; i++) {
		if (books[i] == book) {
			current.bookNumber = i;
			return i
		}
	}
}

// Function called after load
function postLoad(verse) {
	if (!current.verse == 0) {
		scrollToVerse(verse);
		current.verse = 0;
	}
}

// Fun stuff
function help() {
	console.log('Example> goToChapter("John", "3", "16")');
	console.log("Why am I making this.");
}

// So long and thanks for all the fish