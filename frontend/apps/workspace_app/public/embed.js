/*
 * Eleven Nodes app bubble: a chat button that opens a published app in a panel on any website.
 *
 *   <script src="https://<workspace host>/embed.js" data-app="<published app URL>" data-position="bottom-right" async></script>
 *
 * data-position: bottom-right (default) or bottom-left. data-color: the button's colour (#rrggbb, default #EB6115).
 */
(function () {
  var script = document.currentScript
  if (!script || !script.dataset.app || window.__elevenNodesBubble) return
  window.__elevenNodesBubble = true
  var app = script.dataset.app
  var left = script.dataset.position === 'bottom-left'
  var color = /^#[0-9a-fA-F]{6}$/.test(script.dataset.color || '') ? script.dataset.color : '#EB6115'
  var side = left ? 'left:20px;' : 'right:20px;'

  var panel = document.createElement('iframe')
  panel.src = app + (app.indexOf('?') < 0 ? '?' : '&') + 'embed=1'
  panel.title = 'Chat'
  panel.allow = 'clipboard-write'
  panel.style.cssText =
    'position:fixed;bottom:88px;' + side + 'width:min(380px,calc(100vw - 40px));height:min(600px,calc(100vh - 120px));' +
    'border:0;border-radius:14px;box-shadow:0 12px 40px rgba(0,0,0,.18);background:#fff;z-index:2147483646;display:none'

  var button = document.createElement('button')
  button.type = 'button'
  button.setAttribute('aria-label', 'Open chat')
  button.style.cssText =
    'position:fixed;bottom:20px;' + side + 'width:56px;height:56px;border-radius:50%;border:0;cursor:pointer;' +
    'background:' + color + ';color:#fff;box-shadow:0 6px 20px rgba(0,0,0,.2);z-index:2147483647;display:flex;align-items:center;justify-content:center'
  var chat = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>'
  var close = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>'
  button.innerHTML = chat
  button.addEventListener('click', function () {
    var open = panel.style.display === 'none'
    panel.style.display = open ? 'block' : 'none'
    button.innerHTML = open ? close : chat
    button.setAttribute('aria-label', open ? 'Close chat' : 'Open chat')
  })

  function mount() {
    document.body.appendChild(panel)
    document.body.appendChild(button)
  }
  if (document.body) mount()
  else document.addEventListener('DOMContentLoaded', mount)
})()
