let $book := doc("books.xml")
return
<karteikasten>{
  for $book in doc("books.xml")//book
  for $anzahl in (1 to 2)
  where $anzahl=count($book/author)
  return
    <gruppe anzahl="{$anzahl}"></gruppe>
}</karteikasten>