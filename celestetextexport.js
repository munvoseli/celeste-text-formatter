var fileInput = document.createElement("input");
fileInput.setAttribute("type", "file");
fileInput.multiple = true;
document.body.appendChild(fileInput);
var a = document.createElement("a");
document.body.appendChild(a);
function setUpDownload(u8arr, nom)
{
    a.href = URL.createObjectURL(new Blob([u8arr], {type: "application/octet-stream"}));
    a.download = nom;
    a.innerHTML = Math.random();
}
function getvarlenrep (n) // little endian
{
    const len = Math.ceil(Math.log2(n + 1) / 7);
    var arr = new Uint8Array(len);
    for (var i = 0; i < len; i++)
    {
	var a  = n & 127;
	arr[i] = a | 128;
	n >>= 7;
    }
    arr[arr.length - 1] &= 127;
    return arr;
}

function ulsb128 (n)
{
    const len = Math.ceil(Math.log2(n + 1) / 7);
    var result = new Uint8Array(len);
    for (var i = 0; i < len; i++)
    {
	var byte = n & 127;
	n >>= 7;
	result[i] = byte;
    }
    for (var i = 0; i < len - 1; i++)
    {
	result[i] |= 128;
    }
    return result;
}

var encoder = new TextEncoder();
function putStringInUint (arr, string, i)
{
    if (!string)
	return 1; // the number byte for the string length would be 00, the string would have 0 length, it's just 00, so just tell the other part of this file to skip over that byte which is already 00
    var u8arr = encoder.encode(string);
    var n = ulsb128(u8arr.length);
    for (var j = 0; j < n.length; j++)
	arr[i++] = n[j];
    for (var j = 0; j < u8arr.length; j++)
	arr[i++] = u8arr[j];
    return n.length + u8arr.length;
}

function exportString(string)
{
    var arr = new Uint8Array(2 * string.length); // just a guess, might actually not be enough. If it's not, you'll see that the console screams "AAAAAAH"
    var header = "\x07english\x07English\x1aIcons/canadian-english.png\x00\x00\x00\x00\x08Renogare\x00\x00\x80B\x0a(\\s|\\{|\\})\x01,\x03.!?\xdf\x08\x00\x00\x8f-\x00\x00\x13\x02\x00\x00"; // just for English
    var i = 0;
    // curse the lack of polish notation / rpn
    while (i < header.length)
	arr[i] = header.charCodeAt(i++);
    string = string.replace(/\r/g, "");
    string = string.replace(/\n[\t ]+/g, "\n");
    string = string.replace(/[\t ]+\n/g, "\n");
    string = string.replace(/\b=\s*/g, "=\n"); // \b matches the beginning or end of a words, and is used here to prevent the file namer keyboard thing from being read as a key
    string = string.replace(/\n#.*/g, "");
    string = string.replace(/^#.*/, "");
    string += "\na="; // to combat infix notation
    var pre = document.createElement("pre");
    pre.innerHTML = (string);
    document.body.appendChild(pre);
    var j = string.search("BEGIN");
    var jafterspace = j;
    var jequals = -1;
    var key, value;
    const KVARR_STEP = 2;
    var kvarr = [];
    var usedMacros = string.match(/\{\+.*?\}/g);
    var uniqueMacros = usedMacros.filter((c, index) => { // this function brought to you by the internet
	return usedMacros.indexOf(c) === index;
    });
    var macroTable = []; // [index, macro]
    for (var macro of uniqueMacros)
    {
	macroTable.push([-1, macro]);
    }
    // curse infix notation. RPN FTW
    while (j < string.length)
    {
	if (string[j] == "=" && string[j - 1] != "+") // the string[j - 1] != "+" is to prevent the file name thing from being read as a key
	{
	    if (jequals != -1)
	    {
		//value = string.substring(jequals + 2, jafterspace - 1).replace(/\{n\}\n+/g, "{n}").replace(/\n+\{n\}/g, "{n}");
		value = string.substring(jequals + 2, jafterspace - 1).replace(/\{n\}\n+/g, "{n}").replace(/\n+$/, "");
		if (jequals + 2 > jafterspace - 1) // sometimes, there'll be an equation sign where there's nothing after it and that's represented by two 00 bytes as a result
		    value = "";
		kvarr.push(key);
		kvarr.push(value);
	    }
	    key = string.substring(jafterspace, j);
	    jequals = j;
	}
	else if (string[j] != "\n" && string[j - 1] == "\n")
	{
	    jafterspace = j;
	}
	j++;
    }
    
    // done processing the string, now we have an array that we need to process more
    for (var j = 0; j < kvarr.length; j += KVARR_STEP) // key, valuestrict, valuesimple
    {
	for (var indmacro of macroTable)
	{
	    if (indmacro[1].toLowerCase() == "{+" + kvarr[j].toLowerCase() + "}" ||
		indmacro[1].toLowerCase() == "{+ " + kvarr[j].toLowerCase() + "}")
	    {
		indmacro[0] = j + 1;
	    }
	}
    }

 
    for (var j = 0; j < kvarr.length; j += KVARR_STEP) // split the lines
	if (kvarr[j + 1])
	    kvarr[j + 1] = kvarr[j + 1].split(/\n+/);

    for (var j = 0; j < kvarr.length; j += KVARR_STEP)
    {
	if (kvarr[j + 1] === "")
	    kvarr[j + 1] = [];
    }
    // if the line is a text line and not a trigger/silent_trigger or portrait line, add a break after
    for (var j = 0; j < kvarr.length; j += KVARR_STEP)
    {
	var block = kvarr[j + 1];
	for (var l = 0; l < block.length - 1; l++)
	{
	    var ffour = block[l].substring(0, 4);
	    // anchor, silent_trigger, trigger, portrait
	    if (ffour != "{anc" && ffour != "{sil" && block[l].substring(0, 4) != "{tri" && block[l][0] != "[" && ffour != "{por")
		block[l] += "{break}";
	}
    }
    for (var j = 0; j < kvarr.length; j += KVARR_STEP)
    {
	if (!kvarr[j + 1])
	    console.log(kvarr[j]);
	kvarr[j + 1] = kvarr[j + 1].join("").replace(/\n+/g, "{break}").replace(/\[/g, "{portrait ").replace(/\]/g, "}");
    }

    var hasReplaced = true;
    //for (var asdf = 0; asdf < 2; asdf++) // for another age
    while (hasReplaced) // use the macros luke
    {
	hasReplaced = false;
	for (var j = 0; j < kvarr.length; j += KVARR_STEP)
	{
	    for (var indmacro of macroTable)
	    {
		if (kvarr[j + 1].indexOf(indmacro[1]) >= 0)
		{
		    hasReplaced = true;
		    kvarr[j + 1] = kvarr[j + 1].replaceAll(indmacro[1], kvarr[indmacro[0]]).replaceAll("\\#", "#");
		}
	    }
	}
    }
    console.log(macroTable);
    for (var j = 0; j < kvarr.length; j += KVARR_STEP)
    {
	i += putStringInUint(arr, kvarr[j    ], i); // key
	i += putStringInUint(arr, kvarr[j + 1], i); // value full
	var simp = kvarr[j + 1].replaceAll("{n}", "\n").replaceAll("{break}", "\n").replace(/\{.*?\}/g, ""); // squirrel in my pants
	i += putStringInUint(arr, simp, i); // value simple
    }
    pre.innerHTML = JSON.stringify(kvarr, null, 4);
    if (i >= arr.length)
	console.error("aah");
    return arr.slice(0, i);
}

function loadFile(file) {
    var fileReader = new FileReader();
    fileReader.addEventListener("loadend", function(e) {
	var result = fileReader.result;
	var u8arr = exportString(result);
	setUpDownload(u8arr, file.name + ".export");
    }, false);
    fileReader.readAsText(file);
}
fileInput.addEventListener("change", function() {
    var files = fileInput.files;
    for (var file of files) {
	loadFile(file);
    }
}, false);
