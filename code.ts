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

const classes: { [key: string]: string } = {
  // text: "TEXT",
  // rectangle: "RECTANGLE",
  // rectangleImage: "RECTANGLE_IMAGE",
  // ellipse: "ELLIPSE",
  // ellipseImage: "ELLIPSE_IMAGE",
  icon: "ICON",
  iconButton: "ICON_BUTTON",
  commonButton: "COMMON_BUTTON",
  input: "INPUT",
  checkbox: "CHECKBOX",
  card: "CARD",
  list: "LIST",
}

/**
 * Return the list of labels and bboxes of the selected node
 * @param {SceneNode} node
 * @returns {Target}
 */
function getTargetListFromNode(node: SceneNode, parentX: number = 0, parentY: number = 0): Target {
  let bboxesList: Bbox[] = []
  let labelsList: Label[] = []

  const nodeName: string = node.name
  let isTarget: boolean = false

  switch (node.type) {
    case "TEXT":
      labelsList.push(["TEXT"])
      isTarget = true
      break

    case "RECTANGLE":
      if (node.fills !== figma.mixed && node.fills.length > 0) {
        const fill = node.fills[0]
        if (fill.type === "IMAGE") {
          labelsList.push(["IMAGE_RECTANGLE"])
          isTarget = true
          break
        }
      }
      labelsList.push(["RECTANGLE"])
      isTarget = true
      break

    case "LINE":
      labelsList.push(["LINE"])
      isTarget = true
      break

    case "ELLIPSE":
      if (node.fills !== figma.mixed && node.fills.length > 0) {
        const fill = node.fills[0]
        if (fill.type === "IMAGE") {
          labelsList.push(["IMAGE_ELLIPSE"])
          isTarget = true
          break
        }
      }
      labelsList.push(["ELLIPSE"])
      isTarget = true
      break

    default:
      for (const className in classes) {
        if (nodeName.toUpperCase().includes(className.toUpperCase())) {
          labelsList.push([classes[className]])
          isTarget = true
          break
        }
      }
      break
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
 * fetch the image and the target to the destination
 * @param target 
 * @param destination 
 * @param device 
 */
async function fetchTargetsAndImages(target: TargetWithImage, destination: string, device: string) {
  // TODO
}

figma.loadFontAsync({ family: "Inter", style: "Regular" })

const targetsList: TargetWithImage[] = []
let destination: string = ""
let device: string = ""

figma.showUI(__uiFiles__.setting, { width: 300, height: 300 })

figma.clientStorage.getAsync("destination").then((destination) => {
  if (destination) {
    figma.ui.postMessage({ type: "set-destination", destination })
  }
})

figma.clientStorage.getAsync("device").then((device) => {
  if (device) {
    figma.ui.postMessage({ type: "set-device", device })
  }
})

figma.ui.onmessage = async (msg) => {
  switch (msg.type) {
    case "start-checking": {
      destination = msg.destination
      device = msg.device

      figma.clientStorage.setAsync("destination", destination)
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
          await fetchTargetsAndImages(target, destination, device)
          target.image.name = target.image.name + " (completed)"
          successCount += 1
        } catch (error) {
          console.log(error)
        }
      }

      figma.closePlugin(`Converted ${successCount} / ${totalNumberOfTargets} targets.`)
      break
    }

    case "convert-without-checking": {
      destination = msg.destination
      device = msg.device

      figma.clientStorage.setAsync("destination", destination)
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
          await fetchTargetsAndImages(target, destination, device)
          target.image.name = target.image.name + " (completed)"
          successCount += 1
        } catch (error) {
          console.log(error)
        }
      }

      figma.closePlugin(`Converted ${successCount} / ${totalNumberOfTargets} targets.`)
      break
    }

    default:
      figma.closePlugin("Cancelled. Please remove the Checking frames.")
  }
}

