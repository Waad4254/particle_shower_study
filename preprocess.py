import json
import os
import math
import randomcolor
from nutree import Tree, Node, IterMethod


# ==========================================
# 1. Class Definitions (From pythoncode.py)
# ==========================================
class Level:
    def __init__(self, *, level, minTime, maxTime):
        self.level = level
        self.minTime = minTime
        self.maxTime = maxTime

    def __dictx__(self):
        return {
            "level": self.level,
            "minTime": self.minTime,
            "maxTime": self.maxTime
        }


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
        return f"<Id: {self.id}, ParentId: {self.parent}, Level: {self.level}>"


# ==========================================
# 2. Math Helpers (From pythoncode.py)
# ==========================================
def findMin(tracks, level=None, time=False, energy=False, position=None, tangent=None):
    if (len(tracks) == 0): return None
    if (level == None):
        if (time):
            return min(tracks, key=lambda x: x.data.time_beg).data.time_beg
        elif (energy):
            return min(tracks, key=lambda x: x.data.energy_beg).data.energy_beg
        elif (position):
            return (min(min(tracks, key=lambda x: x.data.position_beg[0]).data.position_beg[0],
                        min(tracks, key=lambda x: x.data.position_end[0]).data.position_end[0]),
                    min(min(tracks, key=lambda x: x.data.position_beg[1]).data.position_beg[1],
                        min(tracks, key=lambda x: x.data.position_end[1]).data.position_end[1]),
                    min(min(tracks, key=lambda x: x.data.position_beg[2]).data.position_beg[2],
                        min(tracks, key=lambda x: x.data.position_end[2]).data.position_end[2]))
        elif (tangent):
            return (min(min(tracks, key=lambda x: x.data.tangent_beg[0]).data.tangent_beg[0],
                        min(tracks, key=lambda x: x.data.tangent_end[0]).data.tangent_end[0]),
                    min(min(tracks, key=lambda x: x.data.tangent_beg[1]).data.tangent_beg[1],
                        min(tracks, key=lambda x: x.data.tangent_end[1]).data.tangent_end[1]),
                    min(min(tracks, key=lambda x: x.data.tangent_beg[2]).data.tangent_beg[2],
                        min(tracks, key=lambda x: x.data.tangent_end[2]).data.tangent_end[2]))
    else:
        tracksLevel = tracks.find_all(match=lambda n: (n.data.level == level))
        if (time):
            return min(tracksLevel, key=lambda x: x.data.time_beg).data.time_beg
        elif (energy):
            return min(tracksLevel, key=lambda x: x.data.energy_beg).data.energy_beg
        elif (position):
            return (min(min(tracksLevel, key=lambda x: x.data.position_beg[0]).data.position_beg[0],
                        min(tracksLevel, key=lambda x: x.data.position_end[0]).data.position_end[0]),
                    min(min(tracksLevel, key=lambda x: x.data.position_beg[1]).data.position_beg[1],
                        min(tracksLevel, key=lambda x: x.data.position_end[1]).data.position_end[1]),
                    min(min(tracksLevel, key=lambda x: x.data.position_beg[2]).data.position_beg[2],
                        min(tracksLevel, key=lambda x: x.data.position_end[2]).data.position_end[2]))
        elif (tangent):
            return (min(min(tracksLevel, key=lambda x: x.data.tangent_beg[0]).data.tangent_beg[0],
                        min(tracksLevel, key=lambda x: x.data.tangent_end[0]).data.tangent_end[0]),
                    min(min(tracksLevel, key=lambda x: x.data.tangent_beg[1]).data.tangent_beg[1],
                        min(tracksLevel, key=lambda x: x.data.tangent_end[1]).data.tangent_end[1]),
                    min(min(tracksLevel, key=lambda x: x.data.tangent_beg[2]).data.tangent_beg[2],
                        min(tracksLevel, key=lambda x: x.data.tangent_end[2]).data.tangent_end[2]))


def findMax(tracks, level=None, time=False, energy=False, position=None, tangent=None):
    if (len(tracks) == 0): return None
    if (level == None):
        if (time):
            return max(tracks, key=lambda x: x.data.time_end).data.time_end
        elif (energy):
            return max(tracks, key=lambda x: x.data.energy_end).data.energy_end
        elif (position):
            return (max(max(tracks, key=lambda x: x.data.position_beg[0]).data.position_beg[0],
                        max(tracks, key=lambda x: x.data.position_end[0]).data.position_end[0]),
                    max(max(tracks, key=lambda x: x.data.position_beg[1]).data.position_beg[1],
                        max(tracks, key=lambda x: x.data.position_end[1]).data.position_end[1]),
                    max(max(tracks, key=lambda x: x.data.position_beg[2]).data.position_beg[2],
                        max(tracks, key=lambda x: x.data.position_end[2]).data.position_end[2]))
        elif (tangent):
            return (max(max(tracks, key=lambda x: x.data.tangent_beg[0]).data.tangent_beg[0],
                        max(tracks, key=lambda x: x.data.tangent_end[0]).data.tangent_end[0]),
                    max(max(tracks, key=lambda x: x.data.tangent_beg[1]).data.tangent_beg[1],
                        max(tracks, key=lambda x: x.data.tangent_end[1]).data.tangent_end[1]),
                    max(max(tracks, key=lambda x: x.data.tangent_beg[2]).data.tangent_beg[2],
                        max(tracks, key=lambda x: x.data.tangent_end[2]).data.tangent_end[2]))
    else:
        tracksLevel = tracks.find_all(match=lambda n: (n.data.level == level))
        if (time):
            return max(tracksLevel, key=lambda x: x.data.time_end).data.time_end
        elif (energy):
            return max(tracksLevel, key=lambda x: x.data.energy_end).data.energy_end
        elif (position):
            return (max(max(tracksLevel, key=lambda x: x.data.position_beg[0]).data.position_beg[0],
                        max(tracksLevel, key=lambda x: x.data.position_end[0]).data.position_end[0]),
                    max(max(tracksLevel, key=lambda x: x.data.position_beg[1]).data.position_beg[1],
                        max(tracksLevel, key=lambda x: x.data.position_end[1]).data.position_end[1]),
                    max(max(tracksLevel, key=lambda x: x.data.position_beg[2]).data.position_beg[2],
                        max(tracksLevel, key=lambda x: x.data.position_end[2]).data.position_end[2]))
        elif (tangent):
            return (max(max(tracksLevel, key=lambda x: x.data.tangent_beg[0]).data.tangent_beg[0],
                        max(tracksLevel, key=lambda x: x.data.tangent_end[0]).data.tangent_end[0]),
                    max(max(tracksLevel, key=lambda x: x.data.tangent_beg[1]).data.tangent_beg[1],
                        max(tracksLevel, key=lambda x: x.data.tangent_end[1]).data.tangent_end[1]),
                    max(max(tracksLevel, key=lambda x: x.data.tangent_beg[2]).data.tangent_beg[2],
                        max(tracksLevel, key=lambda x: x.data.tangent_end[2]).data.tangent_end[2]))


def _calc_id(tree, data):
    if hasattr(data, "id"): return data.id
    return hash(data)


# ==========================================
# 3. Main Processing Function
# ==========================================
def process_dataset(input_path, output_data_path, output_time_path):
    print(f"Loading {input_path}...")

    with open(input_path, 'r') as f:
        data = json.load(f)

    tree = Tree(name="Particle Shower", calc_data_id=_calc_id)

    # 1. Assign IDs
    count = 0
    for track in data:
        track["m_g4_id"] = count
        count += 1

    # 2. Build Tree
    for track in data:
        t1 = Track(
            id=track["m_g4_id"], parent_id=track["m_parent"],
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
            tracked=track["m_was_tracked"]
        )
        if (track["m_parent"] == -1 and track["m_g4_id"] == 0):
            tree.add(t1)
        elif (track["m_parent"] != -1):
            parent = tree.find(data_id=track["m_parent"])
            if (parent != None):
                parent.add(t1)

    # ==========================================
    # 2.5 Prune Invisible Ghost Nodes
    # ==========================================
    # We loop because removing a leaf might expose its parent as a new invisible leaf
    # This guarantees chains of 0-length invisible particles are fully removed.
    while True:
        to_remove = []
        # Post-order ensures we look at the deepest leaves first
        for node in tree.iterator(method=IterMethod.POST_ORDER):
            if node.data.id == 0:
                continue  # Never prune the primary root track

            # If it has no children (size 0)
            if len(node.children) == 0:
                # Check physical length using the position vector
                v = node.data.positionVector
                length = math.sqrt(v[0] ** 2 + v[1] ** 2 + v[2] ** 2)

                # If length is effectively 0
                if length < 1e-7:
                    to_remove.append(node)

        if not to_remove:
            break  # No more ghost nodes found, exit loop

        for node in to_remove:
            node.remove()  # Detaches the node from its parent

    # Now that the tree is cleaned, we can safely grab all remaining valid tracks
    rand_color = randomcolor.RandomColor()
    tracksNew = tree.find_all(match=lambda n: (n.data.id != 0))

    positionMin = findMin(tracksNew, position=True)
    positionMax = findMax(tracksNew, position=True)
    tangentMin = findMin(tracksNew, tangent=True)
    tangentMax = findMax(tracksNew, tangent=True)

    # 3. BFS Traversal & Normalization
    for track in tree.iterator(method=IterMethod.LEVEL_ORDER):
        color = rand_color.generate()

        track.data.position_beg = (
            (track.data.position_beg[0] - positionMin[0]) / (positionMax[0] - positionMin[0]),
            (track.data.position_beg[1] - positionMin[1]) / (positionMax[1] - positionMin[1]),
            (track.data.position_beg[2] - positionMin[2]) / (positionMax[2] - positionMin[2])
        )

        track.data.position_end = (
            (track.data.position_end[0] - positionMin[0]) / (positionMax[0] - positionMin[0]),
            (track.data.position_end[1] - positionMin[1]) / (positionMax[1] - positionMin[1]),
            (track.data.position_end[2] - positionMin[2]) / (positionMax[2] - positionMin[2])
        )

        track.data.tangent_beg = (
            (track.data.tangent_beg[0] - tangentMin[0]) / (tangentMax[0] - tangentMin[0]),
            (track.data.tangent_beg[1] - tangentMin[1]) / (tangentMax[1] - tangentMin[1]),
            (track.data.tangent_beg[2] - tangentMin[2]) / (tangentMax[2] - tangentMin[2])
        )

        track.data.tangent_end = (
            (track.data.tangent_end[0] - tangentMin[0]) / (tangentMax[0] - tangentMin[0]),
            (track.data.tangent_end[1] - tangentMin[1]) / (tangentMax[1] - tangentMin[1]),
            (track.data.tangent_end[2] - tangentMin[2]) / (tangentMax[2] - tangentMin[2])
        )

        leadingDir = [0, 0, 0]
        for child in track.children:
            child.data.color = color
            ChildVec = child.data.positionVector
            leadingDir[0] = leadingDir[0] + ChildVec[0]
            leadingDir[1] = leadingDir[1] + ChildVec[1]
            leadingDir[2] = leadingDir[2] + ChildVec[2]

        track.data.leadingDir = leadingDir

    # 4. Post-Order Size Calculation (Now counts perfectly for Vega)
    for track in tree.iterator(method=IterMethod.POST_ORDER):
        for child in track.children:
            track.data.size += child.data.size
        track.data.size += len(track.children)

    # 5. Compile Time Information
    timeJson = {
        "levels": tree.calc_height(),
        "min": findMin(tracksNew, time=True),
        "max": findMax(tracksNew, time=True),
        "minE": findMin(tracksNew, energy=True),
        "maxE": findMax(tracksNew, energy=True),
        "levelsList": []
    }

    for l in range(tree.calc_height()):
        minL = findMin(tree, level=l, time=True)
        maxL = findMax(tree, level=l, time=True)
        levelNew = Level(level=l, minTime=minL, maxTime=maxL)
        timeJson["levelsList"].append(levelNew.__dictx__())

    # 6. Write to Disk
    print(f"Saving Time Info to {output_time_path}...")
    with open(output_time_path, "w") as fp:
        json.dump(timeJson, fp)

    print(f"Saving Data to {output_data_path}...")
    json_list = [ob.data.__dict__ for ob in tree]
    if 'parent' in json_list[0]:
        del json_list[0]['parent']

    with open(output_data_path, "w") as fp:
        json.dump(json_list, fp)

    print("Done!\n")


# ==========================================
# 4. Batch Execution
# ==========================================
if __name__ == "__main__":
    datasets_to_process = [
        ("data/SingleProton-200GeV.json", "t1a_ready.json", "t1a_time.json"),
        ("data/SingleProton-200GeV.json", "t1b_ready.json", "t1b_time.json"),
        ("data/SinglePhoton-200GeV.json", "t2a_ready.json", "t2a_time.json"),
        ("data/SinglePhoton-200GeV.json", "t2b_ready.json", "t2b_time.json"),
        ("data/g4Snitch_singlekaon_e600GeV_eta17_27_zpos_events100_nopu_1.json", "t3a_ready.json", "t3a_time.json"),
        ("data/g4Snitch_singlekaon_e100GeV_eta17_27_zpos_events100_nopu_1.json", "t3b_ready.json", "t3b_time.json"),
    ]

    for raw, out_data, out_time in datasets_to_process:
        if os.path.exists(raw):
            process_dataset(raw, out_data, out_time)
        else:
            print(f"Skipping {raw} - File not found.")