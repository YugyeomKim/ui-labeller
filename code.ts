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

const classes = [
  // "TEXT",
  // "RECTANGLE",
  // "LINE",
  // "ELLIPSE",
  "ICON",
  "IMAGE",
  "BUTTON",
  "INPUT",
  "CHECKBOX",
  "LIST",
]

/**
 * Return the list of labels and bboxes of the selected node
 * @param {SceneNode} node
 * @returns {Target}
 */
function getTargetListFromNode(node: SceneNode): Target {
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
      labelsList.push(["RECTANGLE"])
      isTarget = true
      break
        
    case "LINE":
      labelsList.push(["LINE"])
      isTarget = true
      break 
          
    case "ELLIPSE":
      labelsList.push(["ELLIPSE"])
      isTarget = true
      break  
            
    default:
      for (const className of classes) {
        if (nodeName.toUpperCase().includes(className)) {
          labelsList.push([className])
          isTarget = true        
          break
        }
      }
      break
  }

  if (isTarget) {
    const bbox: Bbox = [
      node.x,
      node.y,
      node.x + node.width,
      node.y + node.height
    ]

    bboxesList.push(bbox)
  }


  if (node.type === "GROUP" 
  || node.type === "FRAME"
  || node.type === "COMPONENT"
  || node.type === "INSTANCE") {
    node.children.forEach((child) => {
      const {
        contentBoxes,
        labels
      } = getTargetListFromNode(child)

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
  
  const { contentBoxes, labels } = target
  
  for (let i = 0; i < contentBoxes.length; i++) {
    const bbox = contentBoxes[i]
    const label = labels[i]

    const rect = figma.createRectangle()
    rect.resize(bbox[2] - bbox[0], bbox[3] - bbox[1])
    rect.x = bbox[0]
    rect.y = bbox[1]
    rect.strokes = [figma.util.solidPaint({r: 1, g: 0, b: 0, a: 1})]
    rect.fills = [figma.util.solidPaint({r: 0, g: 0, b: 0, a: 0})]
    rect.name = label.join(" ")
    newFrame.appendChild(rect)

    const labelTag = figma.createShapeWithText()
    labelTag.resize(100, 20)
    labelTag.x = bbox[0]
    labelTag.y = bbox[1] - 20
    labelTag.fills = [figma.util.solidPaint({r: 1, g: 0, b: 0, a: 1})]
    labelTag.text.fontSize = 12
    labelTag.text.fontName = { family: "Roboto", style: "Regular" }
    labelTag.text.characters = label.join(" ")
    newFrame.appendChild(labelTag)
  }
}

async function fetchTargetsAndImages(targetsList: TargetWithImage, destination: string, device: string) {
  // TODO
}

const targetsList: TargetWithImage[] = []
let destination: string = ""
let device: string = ""

figma.showUI("setting", { width: 300, height: 300 })

figma.ui.onmessage = async (msg) => {
  switch (msg.type) {
    case "start-checking": {
      destination = msg.destination
      device = msg.device 
      const frames = figma.currentPage.children

      frames.forEach((node) => {
        if (node.type === "FRAME") {
          const target = getTargetListFromNode(node)
      
          drawTarget(node, target)
          
          targetsList.push({image: node, target: target})
        }
      })

      figma.showUI("checking", { width: 300, height: 300 })
      break
    }

    case "convert-after-checking": {
      const totalNumberOfTargets = targetsList.length
      let successCount = 0

      for (const target of targetsList) {
        try {
          await fetchTargetsAndImages(target, destination, device)
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
      const frames = figma.currentPage.children

      frames.forEach((node) => {
        if (node.type === "FRAME") {
          const target = getTargetListFromNode(node)
      
          targetsList.push({image: node, target: target})
        }
      })

      const totalNumberOfTargets = targetsList.length
      let successCount = 0

      for (const target of targetsList) {
        try {
          await fetchTargetsAndImages(target, destination, device)
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

