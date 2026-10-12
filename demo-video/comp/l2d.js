/* Mao, the presenter: Live2D Inc.'s official sample model "Niziiro Mao" (Free Material License: free for individuals and
 * small teams, commercial or not; credit required). The model files are loaded at render time from Live2D's own
 * repository (github.com/Live2D/CubismWebSamples) and the runtime from Live2D's CDN; they are not stored in this repo.
 * Credit (video description): "This content uses sample data owned and copyrighted by Live2D Inc. The sample data are
 * utilized in accordance with terms and conditions set by Live2D Inc. This content itself is created at the author's
 * sole discretion."
 *
 * window.__l2d.frame(t, params, grain, ink) renders her once per film time t with the given Live2D parameters (no random
 * idle motions, no random blinks: every value comes from the film's timeline), adds a hand-inked outline and paper
 * grain so she sits in the papery world, and returns that canvas. Hair and cloth physics run continuously; after a
 * jump in time (the first frame of a render shard) they are settled first. */
(function () {
  "use strict";
  var BASE = "https://cdn.jsdelivr.net/gh/Live2D/CubismWebSamples@5-r.5/Samples/Resources/";
  var CW = 1200, CH = 2400, PAD = 24, OUT = 7;
  var app, model, im, P = {}, lastT = null, styled, sctx, outline, octx;
  window.__l2dReady = (async function () {
    app = new PIXI.Application({ width: CW, height: CH, backgroundAlpha: 0, preserveDrawingBuffer: true, autoStart: false, antialias: true });
    model = await PIXI.live2d.Live2DModel.from(BASE + "Mao/Mao.model3.json", { autoInteract: false, autoUpdate: false });
    im = model.internalModel;
    im.eyeBlink = undefined; im.breath = undefined; im.motionManager.update = function () { return false; };
    var sc = (CH - 40) / model.height; model.scale.set(sc); model.x = (CW - model.width) / 2; model.y = 20;
    app.stage.addChild(model);
    im.on("afterMotionUpdate", function () { for (var k in P) im.coreModel.setParameterValueById(k, P[k]); });
    styled = document.createElement("canvas"); styled.width = CW + 2 * PAD; styled.height = CH + 2 * PAD; sctx = styled.getContext("2d");
    outline = document.createElement("canvas"); outline.width = styled.width; outline.height = styled.height; octx = outline.getContext("2d");
    window.__l2d = { W: styled.width, H: styled.height, top: PAD + 20, feet: PAD + CH - 20, frame: frame };
  })();
  function frame(t, params, grain, ink) {
    if (t === lastT) return styled;
    var cont = lastT !== null && Math.abs(t - lastT - 1 / 30) < 1e-3;
    P = params;
    if (!cont) for (var k = 0; k < 45; k++) model.update(1000 / 30); // settle physics after a jump in time
    model.update(1000 / 30); app.render(); lastT = t;
    // hand-inked outline: her silhouette, dilated
    octx.clearRect(0, 0, outline.width, outline.height);
    for (var a = 0; a < 12; a++) { var an = a / 12 * Math.PI * 2; octx.drawImage(app.view, PAD + Math.cos(an) * OUT, PAD + Math.sin(an) * OUT); }
    octx.globalCompositeOperation = "source-in"; octx.fillStyle = ink || "#2a2433"; octx.fillRect(0, 0, outline.width, outline.height);
    octx.globalCompositeOperation = "source-over";
    sctx.clearRect(0, 0, styled.width, styled.height);
    sctx.drawImage(outline, 0, 0); sctx.drawImage(app.view, PAD, PAD);
    // paper grain over her, so she shares the page's texture
    if (grain) { sctx.save(); sctx.globalCompositeOperation = "source-atop"; sctx.globalAlpha = .28; sctx.fillStyle = sctx.createPattern(grain, "repeat"); sctx.fillRect(0, 0, styled.width, styled.height); sctx.restore(); }
    return styled;
  }
})();
