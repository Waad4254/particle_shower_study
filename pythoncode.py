import json

from flask import Flask, render_template, jsonify, request, json
from flask_cors import CORS
import numpy as np
from numpy import array, dot
from nutree import Tree, Node, IterMethod
import randomcolor
from qpsolvers import solve_qp

app = Flask(__name__)
CORS(app)


class Level:
    def __init__(self, *, level, minTime, maxTime):
        self.level = level
        self.minTime = minTime
        self.maxTime = maxTime

    def __dictx__(self):
        nodeJson =  { "level": self.level,
                      "minTime": self.minTime,
                      "maxTime": self.maxTime}
        return nodeJson


class Track:
    def __init__(self, *, id=None, parent_id=None,
                 position_beg, position_end, tangent_beg, tangent_end,
                 time_beg, time_end, energy_beg, energy_end, mass, pdg, charge,
                 level, tracked, color=None):
        self.name = id
        self.id = id
        self.parent = parent_id

        self.position_beg = position_beg
        self.position_end = position_end

        self.z = position_beg[2]

        self.positionVector = (position_end[0] - position_beg[0],
                               position_end[1] - position_beg[1],
                               position_end[2] - position_beg[2])
        self.leadingDir = (0, 0, 0)

        self.tangent_beg = tangent_beg
        self.tangent_end = tangent_end

        self.time_beg = time_beg
        self.time_end = time_end

        self.energy_beg = energy_beg
        self.energy_end = energy_end

        self.mass = mass
        self.pdg = pdg
        self.charge = charge
        self.level = level
        self.tracked = tracked
        self.color = color,
        self.size = 0

    def __repr__(self):
        return f"<Id: {self.id}, ParentId: {self.parent}, Level: {self.level}"


def findMin(tracks, level=None, time=False, energy=False, position=None, tangent=None):
    if (len(tracks) == 0):
        return None
    if (level == None):
        if (time):
            MinObj = min(tracks, key=lambda x: x.data.time_beg).data.time_beg
        elif (energy):
            MinObj = min(tracks, key=lambda x: x.data.energy_beg).data.energy_beg
        elif (position):
            MinObj = (min(min(tracks, key=lambda x: x.data.position_beg[0]).data.position_beg[0],
                          min(tracks, key=lambda x: x.data.position_end[0]).data.position_end[0]),

                      min(min(tracks, key=lambda x: x.data.position_beg[1]).data.position_beg[1],
                          min(tracks, key=lambda x: x.data.position_end[1]).data.position_end[1]),

                      min(min(tracks, key=lambda x: x.data.position_beg[2]).data.position_beg[2],
                          min(tracks, key=lambda x: x.data.position_end[2]).data.position_end[2]))
        elif (tangent):
            MinObj = (min(min(tracks, key=lambda x: x.data.tangent_beg[0]).data.tangent_beg[0],
                          min(tracks, key=lambda x: x.data.tangent_end[0]).data.tangent_end[0]),

                      min(min(tracks, key=lambda x: x.data.tangent_beg[1]).data.tangent_beg[1],
                          min(tracks, key=lambda x: x.data.tangent_end[1]).data.tangent_end[1]),

                      min(min(tracks, key=lambda x: x.data.tangent_beg[2]).data.tangent_beg[2],
                          min(tracks, key=lambda x: x.data.tangent_end[2]).data.tangent_end[2]))


    else:
        tracksLevel = tracks.find_all(match=lambda n: (n.data.level == level))
        if (time):
            MinObj = min(tracksLevel, key=lambda x: x.data.time_beg).data.time_beg
        elif (energy):
            MinObj = min(tracksLevel, key=lambda x: x.data.energy_beg).data.energy_beg
        elif (position):
            MinObj = (min(min(tracksLevel, key=lambda x: x.data.position_beg[0]).data.position_beg[0],
                          min(tracksLevel, key=lambda x: x.data.position_end[0]).data.position_end[0]),

                      min(min(tracksLevel, key=lambda x: x.data.position_beg[1]).data.position_beg[1],
                          min(tracksLevel, key=lambda x: x.data.position_end[1]).data.position_end[1]),

                      min(min(tracksLevel, key=lambda x: x.data.position_beg[2]).data.position_beg[2],
                          min(tracksLevel, key=lambda x: x.data.position_end[2]).data.position_end[2]))
        elif (tangent):
            MinObj = (min(min(tracksLevel, key=lambda x: x.data.tangent_beg[0]).data.tangent_beg[0],
                          min(tracksLevel, key=lambda x: x.data.tangent_end[0]).data.tangent_end[0]),

                      min(min(tracksLevel, key=lambda x: x.data.tangent_beg[1]).data.tangent_beg[1],
                          min(tracksLevel, key=lambda x: x.data.tangent_end[1]).data.tangent_end[1]),

                      min(min(tracksLevel, key=lambda x: x.data.tangent_beg[2]).data.tangent_beg[2],
                          min(tracksLevel, key=lambda x: x.data.tangent_end[2]).data.tangent_end[2]))
    return MinObj


def findMax(tracks, level=None, time=False, energy=False, position=None, tangent=None):
    if (len(tracks) == 0):
        return None
    if (level == None):
        if (time):
            MaxObj = max(tracks, key=lambda x: x.data.time_end).data.time_end
        elif (energy):
            MaxObj = max(tracks, key=lambda x: x.data.energy_end).data.energy_end
        elif (position):
            MaxObj = (max(max(tracks, key=lambda x: x.data.position_beg[0]).data.position_beg[0],
                          max(tracks, key=lambda x: x.data.position_end[0]).data.position_end[0]),

                      max(max(tracks, key=lambda x: x.data.position_beg[1]).data.position_beg[1],
                          max(tracks, key=lambda x: x.data.position_end[1]).data.position_end[1]),

                      max(max(tracks, key=lambda x: x.data.position_beg[2]).data.position_beg[2],
                          max(tracks, key=lambda x: x.data.position_end[2]).data.position_end[2]))
        elif (tangent):
            MaxObj = (max(max(tracks, key=lambda x: x.data.tangent_beg[0]).data.tangent_beg[0],
                          max(tracks, key=lambda x: x.data.tangent_end[0]).data.tangent_end[0]),

                      max(max(tracks, key=lambda x: x.data.tangent_beg[1]).data.tangent_beg[1],
                          max(tracks, key=lambda x: x.data.tangent_end[1]).data.tangent_end[1]),

                      max(max(tracks, key=lambda x: x.data.tangent_beg[2]).data.tangent_beg[2],
                          max(tracks, key=lambda x: x.data.tangent_end[2]).data.tangent_end[2]))
    else:
        tracksLevel = tracks.find_all(match=lambda n: (n.data.level == level))
        if (time):
            MaxObj = max(tracksLevel, key=lambda x: x.data.time_end).data.time_end
        elif (energy):
            MaxObj = max(tracksLevel, key=lambda x: x.data.energy_end).data.energy_end
        elif (position):
            MaxObj = (max(max(tracksLevel, key=lambda x: x.data.position_beg[0]).data.position_beg[0],
                          max(tracksLevel, key=lambda x: x.data.position_end[0]).data.position_end[0]),

                      max(max(tracksLevel, key=lambda x: x.data.position_beg[1]).data.position_beg[1],
                          max(tracksLevel, key=lambda x: x.data.position_end[1]).data.position_end[1]),

                      max(max(tracksLevel, key=lambda x: x.data.position_beg[2]).data.position_beg[2],
                          max(tracksLevel, key=lambda x: x.data.position_end[2]).data.position_end[2]))
        elif (tangent):
            MaxObj = (max(max(tracksLevel, key=lambda x: x.data.tangent_beg[0]).data.tangent_beg[0],
                          max(tracksLevel, key=lambda x: x.data.tangent_end[0]).data.tangent_end[0]),

                      max(max(tracksLevel, key=lambda x: x.data.tangent_beg[1]).data.tangent_beg[1],
                          max(tracksLevel, key=lambda x: x.data.tangent_end[1]).data.tangent_end[1]),

                      max(max(tracksLevel, key=lambda x: x.data.tangent_beg[2]).data.tangent_beg[2],
                          max(tracksLevel, key=lambda x: x.data.tangent_end[2]).data.tangent_end[2]))
    return MaxObj


def _calc_id(tree, data):
    if hasattr(data, "id"):
        return data.id
    return hash(data)

@app.route("/modifyannotation", methods = ['POST'])
def modify_annotation():

    print("TESTING modify_annotation")
    annotation = request.json.get('annotation')
    id = request.json.get('id')

    with open("Data/annotations.json", "r") as jsonfile:
        data = json.load(jsonfile)

    index = data.index(next(filter(lambda n: n.get('id') == id, data)))
    data[index]['annotation'] = annotation

    data_string = json.dumps(data)
    with open('Data/annotations.json', "w") as fp:
        fp.write(data_string)

    return json.dumps({'success': True}), 200, {'ContentType': 'application/json'}


@app.route("/addannotation", methods = ['POST'])
def add_annotation():

    print("TESTING add_annotation")
    annotation = request.json.get('annotation')
    time = request.json.get('time')
    y = request.json.get('y')

    print("TESTING add_annotation",annotation)
    print("TESTING add_annotation",time)
    print("TESTING add_annotation",y)

    with open("Data/annotations.json", "r") as jsonfile:
        data = json.load(jsonfile)

    new_id = max(data,key=lambda x:x['id'])['id'] + 1
    new_data = {"id": new_id, "annotation": annotation, "time": time, "y": y}

    data.append(new_data)

    data_string = json.dumps(data)
    with open('Data/annotations.json', "w") as fp:
        fp.write(data_string)

    return json.dumps({'success': True}), 200, {'ContentType': 'application/json'}

@app.route("/opacity", methods = ['POST'])
def optimize():
    D = request.json.get('D')
    H = request.json.get('H')
    G = request.json.get('G')

    G = np.array(G)
    D = np.array(D)
    H = np.array(H)


    N = G.shape[0]

    # TO DO: get from JS
    sigmentsNo = 4


    # Diagonalize G
    G = np.diag(G)
    # create I matrix
    I = np.identity(N)

    # TO DO: get these from JS
    coff1_p = 1.0
    coff2_q = 0.2
    coff3_r = 0.16
    coff4_s = 0.3
    coff5_lamda = 3.0


    W = np.power((I - G), coff5_lamda) * H * G
    Q = coff1_p * I + coff2_q * (W * W.T) + coff3_r * (W.T * W) + coff4_s * (D.T * D)

    c = -1 * np.ones(N)
    lb = np.zeros(N)
    ub = np.ones(N)

    O = solve_qp(Q, c, lb=lb, ub=ub, solver="quadprog")

    np.reshape(O, (int(N / sigmentsNo), sigmentsNo))

    #print(G)

    return jsonify({"opacity": O.tolist()})


@app.route("/preprocess", methods = ['POST'])
def preprocess():
    # SEND File name fileName
    file_name = request.json.get('fileName')
    # Opening JSON file
    f = open('../Visualization-RC/Data/'+file_name)
    # returns JSON object as
    # a dictionary
    data = json.load(f)
    f.close()

    tree = Tree(name="Particle Shower", calc_data_id=_calc_id)

    # Iterating through the json
    count = 0

    for track in data:
        track["m_g4_id"] = count
        count = count + 1

    # list
    for track in data:
        t1 = Track(id=track["m_g4_id"], parent_id=track["m_parent"],
                   position_beg=(track["m_x_beg"]["fX"], track["m_x_beg"]["fY"], track["m_x_beg"]["fZ"]),
                   position_end=(track["m_x_end"]["fX"], track["m_x_end"]["fY"], track["m_x_end"]["fZ"]),
                   tangent_beg=(track["m_p_beg"]["fX"], track["m_p_beg"]["fY"], track["m_p_beg"]["fZ"]),
                   tangent_end=(track["m_p_end"]["fX"], track["m_p_end"]["fY"], track["m_p_end"]["fZ"]),
                   time_beg=track["m_x_beg"]["fT"],
                   time_end=track["m_x_end"]["fT"],
                   energy_beg=track["m_p_beg"]["fT"],
                   energy_end=track["m_p_end"]["fT"],
                   mass=track["m_mass"],
                   pdg=track["m_pdg"],
                   charge=track["m_charge"],
                   level=track["m_g4_level"],
                   tracked=track["m_was_tracked"])
        if (track["m_parent"] == -1 and track["m_g4_id"] == 0):
            tree.add(t1)
        elif (track["m_parent"] != -1):
            parent = tree.find(data_id=track["m_parent"])
            if (parent != None):
                parent.add(t1)

    rand_color = randomcolor.RandomColor()
    tracksNew = tree.find_all(match=lambda n: (n.data.id != 0))
    positionMin = findMin(tracksNew, position=True)
    positionMax = findMax(tracksNew, position=True)
    tangentMin = findMin(tracksNew, tangent=True)
    tangentMax = findMax(tracksNew, tangent=True)
    energyMin = findMin(tracksNew, energy=True)
    energyMax = 0.1  # findMax(tracksNew, energy = True)

    ## Traversal BFS
    # ROOT
    for track in tree.iterator(method=IterMethod.LEVEL_ORDER):
        color = rand_color.generate()

        ## Normalization

        track.data.position_beg = ((track.data.position_beg[0] - positionMin[0]) / (positionMax[0] - positionMin[0]),
                                   (track.data.position_beg[1] - positionMin[1]) / (positionMax[1] - positionMin[1]),
                                   (track.data.position_beg[2] - positionMin[2]) / (positionMax[2] - positionMin[2]))

        track.data.position_end = ((track.data.position_end[0] - positionMin[0]) / (positionMax[0] - positionMin[0]),
                                   (track.data.position_end[1] - positionMin[1]) / (positionMax[1] - positionMin[1]),
                                   (track.data.position_end[2] - positionMin[2]) / (positionMax[2] - positionMin[2]))

        track.data.tangent_beg = ((track.data.tangent_beg[0] - tangentMin[0]) / (tangentMax[0] - tangentMin[0]),
                                  (track.data.tangent_beg[1] - tangentMin[1]) / (tangentMax[1] - tangentMin[1]),
                                  (track.data.tangent_beg[2] - tangentMin[2]) / (tangentMax[2] - tangentMin[2]))

        track.data.tangent_end = ((track.data.tangent_end[0] - tangentMin[0]) / (tangentMax[0] - tangentMin[0]),
                                  (track.data.tangent_end[1] - tangentMin[1]) / (tangentMax[1] - tangentMin[1]),
                                  (track.data.tangent_end[2] - tangentMin[2]) / (tangentMax[2] - tangentMin[2]))
        #
        # track.data.energy_beg = (track.data.energy_beg - energyMin) / (energyMax - energyMin)
        # track.data.energy_end = (track.data.energy_end - energyMin) / (energyMax - energyMin)

        leadingDir = [0, 0, 0]

        for child in track.children:
            child.data.color = color
            ChildVec = child.data.positionVector
            leadingDir[0] = leadingDir[0] + ChildVec[0]
            leadingDir[1] = leadingDir[1] + ChildVec[1]
            leadingDir[2] = leadingDir[2] + ChildVec[2]

        track.data.leadingDir = leadingDir

    for track in tree.iterator(method=IterMethod.POST_ORDER):
        for child in track.children:
            track.data.size = track.data.size + child.data.size;

        track.data.size = track.data.size + len(track.children);

    timeJson = {"levels": tree.calc_height(),
                "min": findMin(tracksNew, time=True),
                "max": findMax(tracksNew, time=True),
                "minE": findMin(tracksNew, energy=True),
                "maxE": findMax(tracksNew, energy=True)
                }
    levelsList = []
    for l in range(tree.calc_height()):
        minL = findMin(tree, level=l, time=True)
        maxL = findMax(tree, level=l, time=True)
        levelNew = Level(level=l, minTime=minL, maxTime=maxL)
        levelsList.append(levelNew.__dictx__())
    timeJson["levelsList"] = levelsList
    time_string = json.dumps(timeJson)
    with open('../Visualization-RC/Data/output-time.json', "w") as fp:
        fp.write(time_string)

    json_list = [ob.data.__dict__ for ob in tree]
    del json_list[0]['parent']
    json_string = json.dumps(json_list)
    with open('../Visualization-RC/Data/output.json', "w") as fp:
        fp.write(json_string)
    fp.close()

    return json.dumps({'success': True}), 200, {'ContentType': 'application/json'}


if __name__ == __name__:
    app.run(debug=True, port=5500)