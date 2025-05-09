INSERT INTO survey(id, name, schema_json)
SELECT
    '23e4693c-3975-4d91-a2f2-190993043c1c',
    'Initial Survey',
    '{"title":"Feedback Form","type":"object","properties":{"roles":{"type":"array","title":"Co masz robić w projekcie?","items":{"type":"string","enum":["frontend","backend","devops","inne"]},"uniqueItems":true},"rating":{"type":"integer","title":"Jak oceniasz proces do tego momentu?","minimum":1,"maximum":10},"likes":{"type":"string","title":"Co Ci się podoba"},"improvements":{"type":"string","title":"Co byś poprawił?"}},"required":["roles","rating"]}'
      
WHERE NOT EXISTS (SELECT 1 FROM survey WHERE name = 'Initial Survey');
