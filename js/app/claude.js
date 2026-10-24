/* SpamDeck — the live reader. Your key, your browser, straight to Anthropic. Nothing passes through SpamDeck
   (there is no SpamDeck server). The key lives in sessionStorage for this tab only. */
(function (root) {
  'use strict';
  var S = root.SpamDeck, X = S.extract;
  var KEY = 'spamdeck.key', MODEL = 'spamdeck.model';

  function getKey() { try { return sessionStorage.getItem(KEY) || ''; } catch (e) { return ''; } }
  function setKey(k) { try { if (k) sessionStorage.setItem(KEY, k); else sessionStorage.removeItem(KEY); } catch (e) { /* ignore */ } }
  function getModel() { try { return localStorage.getItem(MODEL) || X.DEFAULT_MODEL; } catch (e) { return X.DEFAULT_MODEL; } }
  function setModel(m) { try { localStorage.setItem(MODEL, m); } catch (e) { /* ignore */ } }
  function isOn() { return !!getKey(); }

  function friendlyError(status, body) {
    var msg = body && body.error && body.error.message;
    if (status === 401) return 'Anthropic rejected the key (401). Check it and try again.';
    if (status === 403) return 'The key is not allowed to do this (403): ' + (msg || '');
    if (status === 429) return 'Rate limited (429). Wait a moment and try again.';
    if (status === 400) return 'The API refused the request (400): ' + (msg || 'bad request');
    if (status >= 500) return 'Anthropic had a problem (' + status + '). Try again.';
    return 'API error ' + status + (msg ? ': ' + msg : '');
  }

  // Read one email live. Resolves to a card; rejects with a plain-English error.
  function read(email) {
    var key = getKey();
    if (!key) return Promise.reject(new Error('No API key set. Turn Live AI on first.'));
    var model = getModel();
    var req = X.buildRequest(email, { model: model });
    var headers = Object.assign({ 'x-api-key': key }, req.headers);
    return fetch(req.url, { method: 'POST', headers: headers, body: JSON.stringify(req.body) })
      .catch(function () { throw new Error('The browser could not reach api.anthropic.com. Check your connection; a blocked request usually means an invalid key or a corporate proxy.'); })
      .then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (json) {
          if (!res.ok) throw new Error(friendlyError(res.status, json));
          return X.parseReading(json, email, model);
        });
      });
  }

  function promptPreview(email) {
    var req = X.buildRequest(email || { id: 'x', from: { name: 'Sender', email: 'sender@company.example' }, subject: '(subject)', body: '(the email)' });
    return { system: req.body.system, user: req.body.messages[0].content, schema: JSON.stringify(req.body.output_config.format.schema, null, 2), model: req.body.model };
  }

  S.claude = { getKey: getKey, setKey: setKey, getModel: getModel, setModel: setModel, isOn: isOn, read: read, promptPreview: promptPreview, MODELS: X.MODELS };
})(window);
