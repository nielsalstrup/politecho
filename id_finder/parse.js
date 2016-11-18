chrome.webRequest.onBeforeSendHeaders.addListener(function (details) {
	if (details.tabId != -1) return;
	for (var i = 0; i < details.requestHeaders.length; ++i) {
		if (details.requestHeaders[i].name === "User-Agent") {
			details.requestHeaders[i].value = "Mozilla/5.0 (Macintosh; Intel Mac OS X x.y; rv:10.0) Gecko/20100101 Firefox/10.0";
			break;
		}
	}
	return {
		requestHeaders: details.requestHeaders
	};
}, {
	urls: ["<all_urls>"],
	tabId: -1,
}, ["blocking", "requestHeaders"]);

function getNewsFeedFrequency(done) {
	var frequency = {};

	function fetch(url, depth, fetchDone) {
		var xhr = new XMLHttpRequest();
		xhr.open('GET', url, true);
		xhr.onreadystatechange = function (e) {
			if (xhr.readyState == 4) {
				var text = xhr.responseText;
				var $t = $(text);
				
				var links = $t.find('[role="article"] a').map(function () { return /(.*?)(?:\/\?|\?|$)/.exec($(this).attr('href'))[1]; }).get();
				links.forEach(function (link) {
					if (!frequency.hasOwnProperty(link)) frequency[link] = 0;
					frequency[link]++;
				});

				var next = $t.find('a[href^="/stories.php?aftercursorr"]').last().attr('href');
				if (next && depth) {
					fetch('https://m.facebook.com' + next, depth - 1, fetchDone);
				} else {
					fetchDone();
				}
			}
		}
		xhr.send();
	}

	fetch('https://m.facebook.com/stories.php', 30, function () {
		done(frequency);
	});
}

function getPageLikes(pageId, done) {
	var xhr = new XMLHttpRequest();
	xhr.open('GET', 'https://m.facebook.com/profile.php?id=' + pageId, true);
	xhr.onreadystatechange = function (e) {
		if (xhr.readyState == 4) {
			var text = xhr.responseText;
			var $t = $(text);
			var url2 = 'https://m.facebook.com' + $t.find('a[href$="socialcontext?refid=17"]').attr('href');

			var xhr2 = new XMLHttpRequest();
			xhr2.open('GET', url2, true);
			xhr2.onreadystatechange = function (e) {
				if (xhr2.readyState == 4) {
					var $t = $(xhr2.responseText);
					var profileUrls = $t.find('h4:contains("Friends who like this Page")').siblings().find('a').map(function() { return $(this).attr('href') }).get();
					done(profileUrls);
				}
			}
			xhr2.send();
		}
	}
	xhr.send();
}

function parseDOM(document_root) {
	var share_buttons = document_root.getElementsByClassName('_15kr _5a-2');
	var ids = [];

	for (var i = 0; i < share_buttons.length; i++) {
		ids.push(JSON.parse(share_buttons[i].getAttribute('data-store')).share_id);
	}
	return ids.toString();
}

function getLikes(userId, done) {
	function getUrl(index) {
		return 'https://m.facebook.com/profile.php?id=' + userId + '&v=likes&sectionid=9999&startindex=' + index;
	}

	function fetch(index, fetchDone) {
		var url = getUrl(index);
		var xhr = new XMLHttpRequest();
		xhr.open('GET', url, true);
		xhr.onreadystatechange = function (e) {
			if (xhr.readyState == 4) {
				var text = xhr.responseText;
				var $t = $(text);
				var likes = $t.find('h4:contains("Other")').last().siblings().find('img').siblings().find('span').map(function (e) {return $(this).text()}).get();
				if (likes.length > 0) {
					fetch(index + likes.length, function (moreLikes) {
						fetchDone(likes.concat(moreLikes));
					});
				} else {
					fetchDone([]);
				}
			}
		}
		xhr.send();
	}
	
	fetch(0, done);
}

function getFriends(done) {
	var xhr = new XMLHttpRequest();
	xhr.open('GET', 'https://www.facebook.com', true);
	xhr.onreadystatechange = function (e) {
		if (xhr.readyState == 4) {
			var text = xhr.responseText;
			var ids = JSON.parse(/,list:(\[.*?\])/.exec(text)[1]);
			ids = ids.map(function (e) {
				return /(\d+)-/.exec(e)[1]
			});
			var uniqueIds = ids.filter(function (item, pos) {
				return ids.indexOf(item) == pos;
			})
			done(uniqueIds);
		}
	}
	xhr.send();
}

var lastRequestTime = 0;
var requestInterval = 200;

function parsePage(url, done) {
	var xhr = new XMLHttpRequest();
	xhr.open('GET', url, true);
	xhr.onreadystatechange = function (e) {
		if (xhr.readyState == 4) {
			var text = xhr.responseText;
			var $t = $(text);
			var result = $t.find('code').toArray().map(function (e) {
				return e.innerHTML
			}).filter(function (e) {
				return e.indexOf('id="BrowseResultsContainer"') != -1
			})[0];

			if (!result) {
				// console.log('empty result:', url);
				done([]);
			} else {
				var $q = $(result.slice(5, -4));
				var ids = $q.find('[data-hovercard]').map(function (e) {
					return /id=([\d]+)/.exec($(this).attr('data-hovercard'))[1]
				}).get();
				console.log('results:', ids);
				done(ids);
			}

			// debugger;
			// $(text).find('strong a').each(function () {
			// 	console.log($(this).attr('href'));
			// });

			// var seeMore = $(text).find('#see_more_pager a').attr('href');
			// debugger;
			// if (seeMore) {
			// 	console.log(seeMore);
			// 	parsePage(seeMore, done);
			// }

			// var ids = [];
			// var regexp = /_15kr _5a-2/g;
			// var match;

			// //var text = xhr.responseText.replace(/&quot;/g, '\"');

			// var text = unescape(xhr.responseText);
			// text = text.replace(/&quot;/g, '\"');
			// text = text.replace(/&#123;/g, '{');
			// text = text.replace(/&#125;/g, '}');

			// while ((match = regexp.exec(text)) != null) {
			// 	var start = match.index + text.substring(match.index).indexOf("{");
			// 	var end = start + text.substring(start).indexOf("}") + 1;
			// 	ids.push(JSON.parse(text.slice(start,end)).share_id);
			// }
			// if (ids.length > 0) {
			// 	chrome.runtime.sendMessage({
			// 		action: "parseResponse",
			// 		source: ids
			// 	});
			// }
		}
	}
	var delay = Math.max(lastRequestTime + requestInterval - (+new Date()), 0) + Math.random() * 300;
	lastRequestTime = delay + (+new Date());
	setTimeout(function () {
		xhr.send();
	}, delay);
}

function buildQueryUrl(userId, newsSourceIds) {
	var url = 'https://www.facebook.com/search';
	for (var i = 0; i < newsSourceIds.length; i++) {
		url += '/' + newsSourceIds[i] + '/stories-by';
		if (i > 0) {
			url += '/union/intersect';
		}
	}
	url += '/' + userId + '/stories-liked/intersect';
	return url;
}

function getAllPageIds() {
	return Object.keys(news_dict)
		.concat(Object.keys(fakenews_dict))
		.concat(Object.keys(pol_dict));
}

function getUserScore(userId, done) {
	var pageIds = getAllPageIds();
	var urls = [];
	while (pageIds.length > 0) {
		var url = buildQueryUrl(userId, pageIds.splice(0, 5));
		urls.push(url);
	}
	var returnedCount = 0;
	var foundPageIds = [];
	urls.forEach(function (url) {
		parsePage(url, function (thisIds) {
			foundPageIds.push.apply(foundPageIds, thisIds);
			returnedCount++;
			if (returnedCount == urls.length) {
				done(score(foundPageIds));
			}
		});
	});
}

function getAllFriendScores(done) {
	getFriends(function (userIds) {
		// TODO: remove limit
		userIds = userIds.splice(0, 10);
		// userIds = ['1612626623'];

		var results = [];
		userIds.forEach(function (userId) {
			getLikes(userId, function (likes) {
				results.push({
					userId: userId,
					likes: likes,
				});
				if (results.length == userIds.length) {
					done(results);
				}
			});
		});
	});
}

chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
	console.log("Incoming message", request, sender);
	if (request.action == "parse") {
		// parsePage(buildQueryUrl(request.userId, request.newsSourceIds));
		// getFriends();
		// getAllFriendScores(function (results) {
		// 	console.log(results);
		// });
		// getPageLikes('6013004059');
		getNewsFeedFrequency(function (frequency) {
			console.log(frequency);
		});
		sendResponse('a');
	}
});