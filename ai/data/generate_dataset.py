"""
generate_dataset.py

Generates a synthetic-but-realistic labeled dataset of civic complaints for
training the department classifier and priority classifier.

Each row: text, department, priority

Run:
    python3 generate_dataset.py
Produces:
    complaints.csv (in the same folder)
"""

import csv
import random

random.seed(42)

# ---------------------------------------------------------------------------
# Templates per department. Each tuple is (text_template, priority)
# We use {loc} as a placeholder for a locality/area name to add variety.
# ---------------------------------------------------------------------------

LOCATIONS = [
    "Sector 8", "Sector 12", "MG Road", "Andheri West", "Koramangala",
    "Ward 5", "Rajaji Nagar", "the main market area", "Green Park",
    "Lake View Colony", "the railway colony", "Model Town", "Civil Lines",
    "the industrial area", "Shastri Nagar", "the old city area",
    "Vasant Vihar", "Sector 21", "the housing board colony", "Nehru Colony",
]

TEMPLATES = {
    "Water Supply": [
        ("There has been no water supply in {loc} for three days.", "High"),
        ("Water supply has been irregular in {loc} for the past week.", "Medium"),
        ("The water tanker did not arrive in {loc} today.", "Medium"),
        ("Drinking water in {loc} smells foul and looks dirty.", "High"),
        ("Low water pressure in the pipeline near {loc}.", "Low"),
        ("A major water pipeline has burst near {loc}, flooding the street.", "High"),
        ("No water supply since morning in {loc}, please send a tanker.", "High"),
        ("Water is leaking continuously from a broken pipe in {loc}.", "Medium"),
        ("The water meter installed in {loc} seems faulty and overbilling.", "Low"),
        ("Contaminated water is being supplied to households in {loc}.", "High"),
        ("Water supply timing in {loc} has been reduced without notice.", "Low"),
        ("There is a persistent water shortage in {loc} during summer.", "Medium"),
    ],
    "Roads & Infrastructure": [
        ("There is a huge pothole on the main road near {loc}.", "High"),
        ("The road in {loc} has been damaged after the recent rains.", "Medium"),
        ("Streetlight poles have fallen on the road in {loc}.", "High"),
        ("Construction debris has been left on the road in {loc} for weeks.", "Medium"),
        ("The footpath near {loc} is broken and unsafe for pedestrians.", "Medium"),
        ("A bridge near {loc} has developed a large crack.", "High"),
        ("Road markings near {loc} have faded, causing confusion for drivers.", "Low"),
        ("The newly laid road in {loc} is already cracking.", "Medium"),
        ("There is no footover bridge near the busy crossing in {loc}.", "Low"),
        ("An open manhole on the road in {loc} is a serious safety hazard.", "High"),
        ("Road widening work in {loc} has been abandoned midway.", "Low"),
        ("Speed breakers near the school in {loc} have worn off completely.", "Medium"),
    ],
    "Electricity": [
        ("Transformer exploded and wires are sparking near {loc}.", "High"),
        ("No street lights are working on the main road of {loc}.", "Medium"),
        ("There has been a power outage in {loc} since last night.", "High"),
        ("Frequent power cuts are affecting households in {loc}.", "Medium"),
        ("An exposed electric wire is hanging low near {loc}.", "High"),
        ("The electricity meter in {loc} is showing incorrect readings.", "Low"),
        ("Streetlights in {loc} flicker constantly and need repair.", "Low"),
        ("A power line fell down during the storm near {loc}.", "High"),
        ("Voltage fluctuation is damaging appliances in {loc}.", "Medium"),
        ("The electric pole near {loc} is leaning dangerously.", "High"),
        ("Power supply in {loc} has not been restored after yesterday's cut.", "High"),
        ("Faulty wiring in the streetlight box near {loc} is sparking.", "High"),
    ],
    "Waste Management": [
        ("There has been no garbage collection for two weeks in {loc}.", "Medium"),
        ("Garbage is piling up on the street corner in {loc}.", "Medium"),
        ("The garbage truck skipped {loc} again this week.", "Low"),
        ("A large heap of uncollected waste is rotting near {loc}.", "High"),
        ("Waste segregation bins in {loc} are overflowing.", "Medium"),
        ("Dead animals have been left uncollected near {loc}.", "High"),
        ("Construction waste has been dumped illegally in {loc}.", "Medium"),
        ("The community dustbin in {loc} has not been emptied in days.", "Low"),
        ("Foul smell from accumulated garbage is spreading in {loc}.", "High"),
        ("Plastic waste is scattered all over the park in {loc}.", "Low"),
        ("Garbage collection timings in {loc} keep changing randomly.", "Low"),
        ("Medical waste was found dumped near a residential area in {loc}.", "High"),
    ],
    "Sanitation": [
        ("The public toilet near {loc} is extremely unhygienic.", "Medium"),
        ("Sewage water is overflowing onto the street in {loc}.", "High"),
        ("A drain near {loc} is blocked and causing a foul smell.", "Medium"),
        ("Open defecation is being reported near the outskirts of {loc}.", "Medium"),
        ("The sewer line near {loc} has collapsed, flooding the lane.", "High"),
        ("Mosquito breeding is increasing due to stagnant drain water in {loc}.", "High"),
        ("Public toilets in {loc} have not been cleaned in weeks.", "Medium"),
        ("A manhole cover is missing near {loc}, causing bad odor.", "Medium"),
        ("Drainage water is entering homes in {loc} after every rain.", "High"),
        ("The community toilet complex in {loc} has no water supply.", "Medium"),
        ("Sewage is leaking directly into the drinking water line near {loc}.", "High"),
        ("Foul odor from the choked drain outside {loc} is unbearable.", "Medium"),
    ],
    "Public Transport": [
        ("The bus service to {loc} has been irregular for a month.", "Medium"),
        ("The bus stop shelter near {loc} is broken and offers no cover.", "Low"),
        ("Buses are overcrowded on the route passing through {loc}.", "Low"),
        ("The last bus to {loc} was cancelled without any notice.", "Medium"),
        ("The auto-rickshaw stand near {loc} has no proper signage.", "Low"),
        ("Bus timings displayed at the {loc} stop are outdated.", "Low"),
        ("There is no bus connectivity to the new colony near {loc}.", "Medium"),
        ("The local train service near {loc} was delayed by two hours.", "Medium"),
        ("Conductors on the route through {loc} are misbehaving with passengers.", "Medium"),
        ("The public transport app shows wrong routes for {loc}.", "Low"),
        ("Frequent breakdowns of buses on the route through {loc} are causing delays.", "Medium"),
        ("No wheelchair access is available at the bus stop in {loc}.", "Medium"),
    ],
    "Parks": [
        ("The children's park in {loc} has broken swings and slides.", "Medium"),
        ("Park equipment in {loc} has not been maintained for months.", "Low"),
        ("The park in {loc} has overgrown grass and needs mowing.", "Low"),
        ("Street dogs have taken over the park in {loc}, scaring children.", "Medium"),
        ("The boundary wall of the park in {loc} has collapsed.", "Medium"),
        ("There are no functioning lights in the park at {loc}, unsafe at night.", "Medium"),
        ("The public garden near {loc} lacks proper waste bins.", "Low"),
        ("Benches in the park at {loc} are broken and rusted.", "Low"),
        ("The walking track in the park near {loc} is damaged.", "Low"),
        ("Anti-social elements gather in the park at {loc} at night.", "Medium"),
        ("The fountain in the park near {loc} has been non-functional for a year.", "Low"),
        ("Trees in the park at {loc} need urgent pruning, branches are falling.", "Medium"),
    ],
    "Others": [
        ("Stray dogs have been aggressive towards residents in {loc}.", "Medium"),
        ("Noise pollution from a nearby factory in {loc} continues at night.", "Medium"),
        ("Illegal parking is blocking the entrance of {loc} society.", "Low"),
        ("A loudspeaker is being used past permitted hours near {loc}.", "Low"),
        ("Encroachment by vendors is blocking the pavement in {loc}.", "Low"),
        ("Unauthorized construction is taking place near {loc}.", "Medium"),
        ("Air pollution levels near the factory in {loc} are very high.", "High"),
        ("A stray cattle menace is causing accidents on the road in {loc}.", "Medium"),
        ("Public property was vandalized near {loc} last night.", "Medium"),
        ("A general complaint about civic apathy in the {loc} ward office.", "Low"),
        ("Fireworks are being burst illegally at odd hours in {loc}.", "Low"),
        ("Residents of {loc} report an unidentified bad smell in the air.", "Medium"),
    ],
}


def build_rows():
    rows = []
    for department, templates in TEMPLATES.items():
        for text_template, priority in templates:
            # create a couple of location variations per template for more data
            sampled_locations = random.sample(LOCATIONS, k=3)
            for loc in sampled_locations:
                text = text_template.format(loc=loc)
                rows.append((text, department, priority))
    random.shuffle(rows)
    return rows


def main():
    rows = build_rows()
    out_path = "complaints.csv"
    with open(out_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["text", "department", "priority"])
        writer.writerows(rows)
    print(f"Wrote {len(rows)} rows to {out_path}")


if __name__ == "__main__":
    main()
