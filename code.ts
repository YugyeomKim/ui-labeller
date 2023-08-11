figma.skipInvisibleInstanceChildren = true;
const SERVER = 'http://localhost:3000/download'

type Bbox = [number, number, number, number]

type Label = string[]

interface Target {
  contentBoxes: Bbox[]
  labels: Label[]
}

interface TargetWithImage {
  image: SceneNode
  target: Target
}

const highPriorityClasses: { [key: string]: string } = {
  statusBar: "STATUS_BAR",
  homeIndicator: "HOME_INDICATOR",
  TextButton: "TEXT_BUTTON",
}

const classes: { [key: string]: string } = {
  // text: "TEXT",
  // rectangleImage: "RECTANGLE_IMAGE",
  // ellipseImage: "ELLIPSE_IMAGE",
  // rectangle: "RECTANGLE",
  // ellipse: "ELLIPSE",
  textField: "TEXT_FIELD",
  searchField: "SEARCH_FIELD",
  commonButton: "COMMON_BUTTON",
  iconButton: "ICON_BUTTON",
  icon: "ICON",
  segmentedButton: "SEGMENTED_BUTTON",
  switch: "SWITCH",
  topAppBar: "TOP_APP_BAR",
  badge: "BADGE",
  chip: "CHIP",
  list: "LIST",
  row: "ROW",
  card: "CARD",
  carousel: "CAROUSEL",
  grid: "GRID",
  tabBar: "TAB_BAR",
  tab: "TAB",
  bottomNavigation: "BOTTOM_NAVIGATION",
  backDrop: "BACK_DROP",
  banner: "BANNER",
  modal: "MODAL",
}

/**
 * Return the list of labels and bboxes of the selected node
 * @param {SceneNode} node
 * @returns {Target}
 */
function getTargetListFromNode(node: SceneNode, parentX: number = 0, parentY: number = 0): Target {
  console.log(node.name)
  
  let bboxesList: Bbox[] = []
  let labelsList: Label[] = []

  const nodeName: string = node.name
  let isTarget: boolean = false

  for (const className in highPriorityClasses) {
    if (nodeName.toUpperCase() === className.toUpperCase()) {
      labelsList.push([highPriorityClasses[className]])
      isTarget = true
      break
    }
  }
  
  if (isTarget) {
    // For not target yet
  } else if (node.type === "TEXT") {
    labelsList.push(["TEXT"])
    isTarget = true
  } else if (
    "fills" in node 
    && node.fills !== figma.mixed 
    && node.fills.length > 0
    && node.fills[0].type === "IMAGE"
  ) {
    if (node.type === "ELLIPSE") {
      labelsList.push(["IMAGE_ELLIPSE"])
    } else {
      labelsList.push(["IMAGE_RECTANGLE"])
    }
    isTarget = true
  } else if (node.type === "RECTANGLE") {
    labelsList.push(["RECTANGLE"])
    isTarget = true
  } else if (node.type === "ELLIPSE") {
    labelsList.push(["ELLIPSE"])
    isTarget = true
  } else {
    for (const className in classes) {
      if (nodeName.toUpperCase() === className.toUpperCase()) {
        labelsList.push([classes[className]])
        isTarget = true
        break
      }
    }
  }

  if (isTarget) {
    const bbox: Bbox = [
      parentX + node.x,
      parentY + node.y,
      parentX + node.x + node.width,
      parentY + node.y + node.height
    ]

    bboxesList.push(bbox)
  }

  if (node.type === "GROUP") {
    node.children.forEach((child) => {
      const { contentBoxes, labels } = getTargetListFromNode(child, parentX, parentY)

      bboxesList = bboxesList.concat(contentBoxes)
      labelsList = labelsList.concat(labels)
    })
  } else if (
    node.type === "FRAME"
    || node.type === "COMPONENT"
    || node.type === "INSTANCE"
  ) {
    node.children.forEach((child) => {
      let contentBoxes: Bbox[] = []
      let labels: Label[] = []

      if (
        node.parent
        && node.parent.type !== "PAGE"
      ) {
        const result = getTargetListFromNode(child, parentX + node.x, parentY + node.y)
        contentBoxes = result.contentBoxes
        labels = result.labels
      } else {
        const result = getTargetListFromNode(child)
        contentBoxes = result.contentBoxes
        labels = result.labels
      }

      bboxesList = bboxesList.concat(contentBoxes)
      labelsList = labelsList.concat(labels)
    })
  }

  return { contentBoxes: bboxesList, labels: labelsList }
}

/**
 * Draw target on the dataset
 * @param {FrameNode} frame 
 * @param {Target} target 
 */
function drawTarget(frame: FrameNode, target: Target) {
  const newFrame = figma.createFrame()
  newFrame.resize(frame.width, frame.height)
  newFrame.x = frame.x
  newFrame.y = frame.y
  newFrame.name = frame.name + " (target)"
  newFrame.fills = [figma.util.solidPaint({ r: 0, g: 0, b: 0, a: 0.1 })]

  const { contentBoxes, labels } = target

  for (let i = 0; i < contentBoxes.length; i++) {
    const bbox = contentBoxes[i]
    const label = labels[i]

    const rect = figma.createRectangle()
    newFrame.appendChild(rect)

    rect.resize(bbox[2] - bbox[0], bbox[3] - bbox[1])
    rect.x = bbox[0]
    rect.y = bbox[1]
    rect.strokes = [figma.util.solidPaint({ r: 1, g: 0, b: 0, a: 1 })]
    rect.fills = [figma.util.solidPaint({ r: 0, g: 0, b: 0, a: 0 })]
    rect.name = label.join(" ")

    const labelTagBox = figma.createRectangle()
    const labelTagText = figma.createText()
    figma.group([rect, labelTagBox, labelTagText], newFrame)

    labelTagBox.resize(50, 10)
    labelTagBox.x = bbox[0]
    labelTagBox.y = bbox[1] - 10
    labelTagBox.topLeftRadius = 5
    labelTagBox.topRightRadius = 5
    labelTagBox.fills = [figma.util.solidPaint({ r: 1, g: 0, b: 0, a: 1 })]

    labelTagText.resize(50, 10)
    labelTagText.x = bbox[0]
    labelTagText.y = bbox[1] - 10
    labelTagText.fontSize = 6
    labelTagText.textAlignHorizontal = "CENTER"
    labelTagText.textAlignVertical = "CENTER"
    labelTagText.characters = label.join(" ")
    labelTagText.fills = [figma.util.solidPaint({ r: 1, g: 1, b: 1, a: 1 })]
  }
}

/**
 * fetch the image and the target
 * @param target 
 * @param device 
 */
async function fetchTargetsAndImages(target: TargetWithImage, device: string) {
  const bytes = await target.image.exportAsync({ format: "PNG" })
  
  const body = {
    pngBlob: Array.from(bytes),
    jsonData: target.target,
    fileName: device
  }

  const response = await fetch(SERVER, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: {
      "Content-Type": "application/json",
    },
  }).catch((err) => {
    throw new Error(err.message);
  })

  switch (response.status) {
    case 200:
      return response.statusText
    
    default:
      throw new Error(`${response.status}: ${response.statusText}`)
  }
}

figma.loadFontAsync({ family: "Inter", style: "Regular" })

const targetsList: TargetWithImage[] = []
let device: string = ""

figma.clientStorage.getAsync("device").then((device) => {
  if (device) {
    figma.ui.postMessage({ type: "set-device", device })
  }
})

figma.showUI(__uiFiles__.setting, { width: 300, height: 300 })


/**
 * Get the message from the UI
 * @param msg blahblah
 */
figma.ui.onmessage = async (msg) => {
  switch (msg.type) {
    case "start-checking": {
      device = msg.device

      figma.clientStorage.setAsync("device", device)

      const frames = figma.currentPage.children

      frames.forEach((node) => {
        if (
          node.type === "FRAME"
          && !node.name.endsWith("(target)")
          && !node.name.endsWith("(completed)")
        ) {
          const target = getTargetListFromNode(node)

          drawTarget(node, target)

          targetsList.push({ image: node, target: target })
        }
      })

      figma.showUI(__uiFiles__.checking, { width: 300, height: 300 })
      break
    }

    case "convert-after-checking": {
      const totalNumberOfTargets = targetsList.length
      let successCount = 0

      for (const target of targetsList) {
        try {
          const statusText = await fetchTargetsAndImages(target, device)
          console.log(`${target.image.name}| ${statusText}`)
          
          target.image.name = target.image.name + " (completed)"
          successCount += 1
        } catch (error) {
          console.log(`${target.image.name}| ${error}`)
        }
      }

      figma.closePlugin(`Converted ${successCount} / ${totalNumberOfTargets} targets.`)
      break
    }

    case "convert-without-checking": {
      device = msg.device

      figma.clientStorage.setAsync("device", device)

      const frames = figma.currentPage.children

      frames.forEach((node) => {
        if (
          node.type === "FRAME"
          && !node.name.endsWith("(target)")
          && !node.name.endsWith("(completed)")
        ) {
          const target = getTargetListFromNode(node)

          targetsList.push({ image: node, target: target })
        }
      })

      const totalNumberOfTargets = targetsList.length
      let successCount = 0

      for (const target of targetsList) {
        try {
          const statusText = await fetchTargetsAndImages(target, device)
          console.log(`${target.image.name}: ${statusText}`)

          target.image.name = target.image.name + " (completed)"
          successCount += 1
        } catch (error) {
          console.log(`${target.image.name}: ${error}`)
        }
      }

      figma.closePlugin(`Converted ${successCount} / ${totalNumberOfTargets} targets.`)
      break
    }

    default:
      figma.closePlugin("Cancelled. Please remove the Checking frames.")
  }
}

