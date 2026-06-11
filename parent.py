import json
import math


def calculate_length(pos_beg, pos_end):
    """Calculates 3D Euclidean distance."""
    if not pos_beg or not pos_end:
        return 0.0
    dx = pos_end[0] - pos_beg[0]
    dy = pos_end[1] - pos_beg[1]
    dz = pos_end[2] - pos_beg[2]
    return math.sqrt(dx ** 2 + dy ** 2 + dz ** 2)


def find_strict_study_tracks(json_filepath, min_length=1.0):
    try:
        with open(json_filepath, 'r') as f:
            tracks = json.load(f)
    except Exception as e:
        print(f"Error loading file: {e}")
        return

    track_map = {t['id']: t for t in tracks}
    children_map = {}

    for t in tracks:
        p_id = t.get('parent')
        if p_id is not None:
            if p_id not in children_map:
                children_map[p_id] = []
            children_map[p_id].append(t)

    results = []
    for parent_id, children in children_map.items():
        if len(children) >= 2:
            parent_track = track_map.get(parent_id)
            if not parent_track:
                continue

            parent_len = calculate_length(parent_track['position_beg'], parent_track['position_end'])

            if parent_len >= min_length:
                # STRICT CHECK: Ensure ALL children are long enough
                all_long_enough = True
                for child in children:
                    child_len = calculate_length(child['position_beg'], child['position_end'])
                    if child_len < min_length:
                        all_long_enough = False
                        break

                if all_long_enough:
                    child_ids = [str(c['id']) for c in children]
                    results.append({
                        'Parent_ID': parent_id,
                        'Parent_Length': round(parent_len, 2),
                        'Daughter_Count': len(children),
                        'Daughter_IDs': ", ".join(child_ids)
                    })

    if results:
        results.sort(key=lambda x: x['Parent_Length'], reverse=True)
        print(f"\nFound {len(results)} candidate(s) where Parent AND ALL Daughters are >= {min_length}:\n")
        print(f"{'Parent ID':<12} | {'Parent Length':<15} | {'Daughters':<10} | {'Daughter IDs'}")
        print("-" * 75)
        for res in results:
            print(
                f"{res['Parent_ID']:<12} | {res['Parent_Length']:<15.2f} | {res['Daughter_Count']:<10} | {res['Daughter_IDs']}")
        print("\n")
    else:
        print(f"\nNo tracks found matching the strict criteria with min_length={min_length}.\n")

if __name__ == "__main__":
    # UPDATE THIS to match the actual path to your JSON file
    FILE_PATH = "./data/t3b_ready.json"

    # You can change min_length. 1.5 is a good starting point for 3D visibility
    find_strict_study_tracks(FILE_PATH, min_length=0.05)